import { beforeEach, describe, expect, it, vi } from "vitest";

import { equalShares, reconcileShares, shareDifferenceCents, validateShares } from "./split";
import type { FinancialEvent, NewFinancialEvent } from "./types";

const state = vi.hoisted(() => ({ events: [] as FinancialEvent[] }));
const notify = vi.hoisted(() => vi.fn(async () => ({ status: "sent", to: "x@example.com" })));
const ai = vi.hoisted(() => ({ result: null as null | { shares: { key: string; amount: number; items?: string }[]; explanation?: string } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireOwnerId: async () => "auth0|splitter", requireSession: async () => ({ user: { id: "auth0|splitter" } }) }));
vi.mock("@/lib/email/notify-friend", () => ({ notifyFriend: notify }));
vi.mock("./split-ai", () => ({ suggestSharesWithGemini: vi.fn(async () => ai.result) }));
vi.mock("./repository", () => ({
  getFinancialEventRepository: () => ({
    listEvents: async () => state.events.map((e) => ({ ...e })),
    createEvent: async (input: NewFinancialEvent) => {
      const event = { ...input, id: crypto.randomUUID() };
      state.events.push(event);
      return event;
    },
    updateEvent: async () => {
      throw new Error("not used");
    },
    deleteEvent: async () => {},
  }),
}));

import { addFriend, getFriends } from "./friends";
import { createSplit, suggestSplit } from "./split-actions";

describe("split maths", () => {
  it("splits evenly and gives leftover cents to the first people", () => {
    expect(equalShares(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(equalShares(39.78, 4)).toEqual([9.95, 9.95, 9.94, 9.94]);
    expect(shareDifferenceCents(100, equalShares(100, 3))).toBe(0);
  });

  it("validates that shares add up exactly", () => {
    expect(validateShares(40, [20, 20])).toBeNull();
    expect(validateShares(40, [20, 15])).toBe("$5.00 of the bill isn't assigned to anyone yet.");
    expect(validateShares(40, [30, 15])).toBe("Shares are $5.00 more than the bill.");
    expect(validateShares(40, [50, -10])).toBe("Shares can't be negative.");
  });

  it("fixes small AI rounding gaps but flags real mismatches", () => {
    expect(reconcileShares(86.4, [25.1, 28.3, 16.5, 16.49])).toEqual({ shares: [25.1, 28.31, 16.5, 16.49], adjusted: true });
    expect(reconcileShares(86.4, [10, 10, 10, 10]).warning).toBeTruthy();
  });
});

const receipt = (overrides: Partial<FinancialEvent> = {}): FinancialEvent => ({
  id: "r1", date: "2026-10-17T00:00:00.000Z", amount: 39.78, direction: "expense", record: "actual", certainty: "certain",
  recurrence: "one-time", source: "manual", category: "Dining", counterparty: "Satchel's Pizza", isReceipt: true, notes: "pizza night", ...overrides,
});

beforeEach(() => {
  state.events = [];
  notify.mockClear();
  ai.result = null;
});

describe("createSplit", () => {
  it("turns a receipt into balances the others owe you, linked to it, without a second expense", async () => {
    state.events = [receipt()];
    const alex = await addFriend("auth0|splitter", { name: "Alex Split", email: "alex@example.com" });
    const res = await createSplit({
      receiptId: "r1",
      dueDate: "2026-10-25",
      notify: true,
      participants: [
        { key: "me", kind: "me", name: "You", amount: 19.78 },
        { key: alex.id, kind: "friend", friendId: alex.id, name: alex.name, amount: 10 },
        { key: "guest-1", kind: "guest", name: "Sreeram", amount: 10 },
      ],
    });
    expect(res).toMatchObject({ ok: true, created: 2, emailed: 1 });
    const balances = state.events.filter((e) => e.category === "Repayment");
    expect(balances).toHaveLength(2);
    expect(balances.every((b) => b.sourceRecordId === "split/r1" && b.direction === "income" && b.record === "planned")).toBe(true);
    expect(balances.find((b) => b.counterparty === "Sreeram")?.friendId).toBeUndefined();
    expect(state.events.filter((e) => e.direction === "expense")).toHaveLength(1);
  });

  it("refuses shares that don't add up, and splitting the same receipt twice", async () => {
    state.events = [receipt()];
    const wrong = await createSplit({ receiptId: "r1", dueDate: "2026-10-25", notify: false, participants: [{ key: "me", kind: "me", name: "You", amount: 10 }, { key: "g", kind: "guest", name: "Jo", amount: 10 }] });
    expect(wrong.ok).toBe(false);
    await createSplit({ receiptId: "r1", dueDate: "2026-10-25", notify: false, participants: [{ key: "me", kind: "me", name: "You", amount: 19.78 }, { key: "g", kind: "guest", name: "Jo", amount: 20 }] });
    const again = await createSplit({ receiptId: "r1", dueDate: "2026-10-25", notify: false, participants: [{ key: "me", kind: "me", name: "You", amount: 19.78 }, { key: "g", kind: "guest", name: "Jo", amount: 20 }] });
    expect(again).toMatchObject({ ok: false, message: "This receipt has already been split." });
  });

  it("records a new bill once, and saves one-off people with an email as friends", async () => {
    const res = await createSplit({
      newExpense: { merchant: "Publix", amount: 60, date: "2026-10-17", category: "Groceries", notes: "potatoes, milk" },
      dueDate: "2026-10-25",
      notify: false,
      participants: [{ key: "me", kind: "me", name: "You", amount: 30 }, { key: "g", kind: "guest", name: "Priya Split", email: "Priya@Example.com", amount: 30 }],
    });
    expect(res.ok).toBe(true);
    expect(state.events.filter((e) => e.isReceipt)).toEqual([expect.objectContaining({ counterparty: "Publix", amount: 60, notes: "potatoes, milk" })]);
    expect((await getFriends("auth0|splitter")).find((f) => f.name === "Priya Split")?.email).toBe("priya@example.com");
  });

  it("writes nothing when one person's details are invalid", async () => {
    const res = await createSplit({
      newExpense: { merchant: "Cafe", amount: 20, date: "2026-10-17", category: "Dining" },
      dueDate: "2026-10-25",
      notify: false,
      participants: [{ key: "a", kind: "guest", name: "Ok", amount: 10 }, { key: "b", kind: "guest", name: "Bad", email: "nope", amount: 10 }],
    });
    expect(res.ok).toBe(false);
    expect(state.events).toHaveLength(0);
  });
});

describe("suggestSplit", () => {
  const people = [{ key: "me", name: "You" }, { key: "s", name: "Sreeram" }];

  it("reconciles Gemini's amounts to the exact total", async () => {
    ai.result = { shares: [{ key: "me", amount: 14.99, items: "pasta" }, { key: "s", amount: 24.78, items: "pizza" }], explanation: "By item." };
    const res = await suggestSplit({ total: 39.78, merchant: "Satchel's", people, description: "I had pasta, Sreeram had pizza" });
    expect(res).toMatchObject({ ok: true, shares: { me: 14.99, s: 24.79 }, items: { me: "pasta", s: "pizza" } });
  });

  it("explains when AI isn't available", async () => {
    const res = await suggestSplit({ total: 39.78, merchant: "Satchel's", people, description: "I had pasta" });
    expect(res).toEqual({ ok: false, message: "AI suggestions aren't available right now. Split equally or enter the amounts yourself." });
  });
});
