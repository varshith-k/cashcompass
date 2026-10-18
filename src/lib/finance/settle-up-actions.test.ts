import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancialEvent, NewFinancialEvent } from "./types";

const state = vi.hoisted(() => ({ events: [] as FinancialEvent[] }));
const notify = vi.hoisted(() => vi.fn(async () => ({ status: "sent", to: "sam@example.com" })));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireOwnerId: async () => "auth0|settle-test", requireSession: async () => ({ user: { id: "auth0|settle-test", name: "Settle Tester", email: "settle@example.com" } }) }));
vi.mock("@/lib/email/notify-friend", () => ({ notifyFriend: notify }));
vi.mock("./repository", async (importOriginal) => ({
  ...await importOriginal<typeof import("./repository")>(),
  getFinancialEventRepository: () => ({
    listEvents: async () => state.events.map((e) => ({ ...e })),
    createEvent: async (input: NewFinancialEvent) => {
      const event = { ...input, id: crypto.randomUUID() };
      state.events.push(event);
      return event;
    },
    updateEvent: async (id: string, patch: Partial<FinancialEvent>) => {
      const i = state.events.findIndex((e) => e.id === id);
      return (state.events[i] = { ...state.events[i]!, ...patch });
    },
    deleteEvent: async () => {},
  }),
}));

import { createLedgerEntry } from "./actions";
import { getFriends } from "./friends";
import { settleLedgerAmount } from "./ledger";
import { addFriendAction, sendSettleUpReminder } from "./settle-up-actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  state.events = [];
  notify.mockClear();
});

describe("Settle Up actions", () => {
  it("records a balance with a saved friend and emails them when asked", async () => {
    const result = await createLedgerEntry(form({ direction: "income", friendId: "friend-sam", amount: "25", date: "2026-11-01", notify: "on" }));
    expect(state.events[0]).toMatchObject({ counterparty: "Sam (roommate)", friendId: "friend-sam", counterpartyPhone: "+15555550123", category: "Repayment" });
    expect(notify).toHaveBeenCalledWith("added", expect.objectContaining({ friendId: "friend-sam", amount: 25 }));
    expect(result).toEqual({ status: "sent", to: "sam@example.com" });
  });

  it("doesn't email when the box is unticked, or for someone who isn't a friend", async () => {
    await createLedgerEntry(form({ direction: "income", friendId: "friend-sam", amount: "25", date: "2026-11-01" }));
    expect(await createLedgerEntry(form({ direction: "expense", friendId: "", counterparty: "Taylor", amount: "9", date: "2026-11-01", notify: "on" }))).toBeNull();
    expect(state.events[1]).toMatchObject({ counterparty: "Taylor", friendId: undefined });
    expect(notify).not.toHaveBeenCalled();
  });

  it("emails a payment confirmation with the amount and what remains", async () => {
    await createLedgerEntry(form({ direction: "income", friendId: "friend-sam", amount: "100", date: "2026-11-01" }));
    await settleLedgerAmount(state.events[0]!.id, 30);
    expect(notify).toHaveBeenCalledWith("payment", expect.objectContaining({ friendId: "friend-sam" }), { amount: 30, remaining: 70 });
    expect(state.events[1]).toMatchObject({ amount: 30, friendId: "friend-sam", record: "actual" });
  });

  it("only sends reminders for balances a friend owes you", async () => {
    await createLedgerEntry(form({ direction: "expense", friendId: "friend-alex", amount: "60", date: "2026-11-01" }));
    await expect(sendSettleUpReminder(state.events[0]!.id)).rejects.toThrow();
    await createLedgerEntry(form({ direction: "income", friendId: "friend-sam", amount: "10", date: "2026-11-01" }));
    await sendSettleUpReminder(state.events[1]!.id);
    expect(notify).toHaveBeenCalledWith("reminder", expect.objectContaining({ direction: "income" }));
  });

  it("saves 'someone else' with an email as a friend and emails them", async () => {
    const result = await createLedgerEntry(form({ direction: "income", friendId: "", counterparty: "  Jess  Rivera ", email: "Jess@Example.com", amount: "18", date: "2026-11-02", notify: "on" }));
    const jess = (await getFriends("auth0|settle-test")).find((f) => f.name === "Jess Rivera");
    expect(jess?.email).toBe("jess@example.com");
    expect(state.events[0]).toMatchObject({ counterparty: "Jess Rivera", friendId: jess?.id });
    expect(notify).toHaveBeenCalledWith("added", expect.objectContaining({ friendId: jess?.id }));
    expect(result).toEqual({ status: "sent", to: "sam@example.com" });

    // Same name again links to the same friend instead of duplicating.
    await createLedgerEntry(form({ direction: "expense", friendId: "", counterparty: "jess rivera", email: "jess@example.com", amount: "5", date: "2026-11-03" }));
    expect((await getFriends("auth0|settle-test")).filter((f) => f.name.toLowerCase() === "jess rivera")).toHaveLength(1);
    expect(state.events[1]!.friendId).toBe(jess?.id);
  });

  it("rejects an invalid email for someone else and saves nothing", async () => {
    await expect(createLedgerEntry(form({ direction: "income", friendId: "", counterparty: "Kim", email: "not-an-email", amount: "9", date: "2026-11-02" }))).rejects.toThrow();
    expect(state.events).toHaveLength(0);
  });

  it("validates new friends", async () => {
    const idle = { status: "idle" as const, message: "" };
    expect((await addFriendAction(idle, form({ name: "Jo", email: "not-an-email" }))).status).toBe("error");
    expect((await addFriendAction(idle, form({ name: "" }))).status).toBe("error");
    expect((await addFriendAction(idle, form({ name: "Jo Park", email: "Jo@Example.com" }))).status).toBe("saved");
    expect((await getFriends("auth0|settle-test")).find((f) => f.name === "Jo Park")?.email).toBe("jo@example.com");
    expect((await addFriendAction(idle, form({ name: "jo park" }))).status).toBe("error");
  });

  it("accepts both Nessie account id formats (current UUIDs and legacy 24-hex) and rejects others", async () => {
    const idle = { status: "idle" as const, message: "" };
    const uuid = "3f2b8c1e-9d4a-4b6f-a1c2-7e5d9f0b1a2c";
    expect((await addFriendAction(idle, form({ name: "Uuid Friend", nessieAccountId: uuid.toUpperCase() }))).status).toBe("saved");
    expect((await getFriends("auth0|settle-test")).find((f) => f.name === "Uuid Friend")?.nessieAccountId).toBe(uuid);
    expect((await addFriendAction(idle, form({ name: "Hex Friend", nessieAccountId: "0123456789abcdef01234567" }))).status).toBe("saved");
    expect((await addFriendAction(idle, form({ name: "Bad Friend", nessieAccountId: "12345" }))).status).toBe("error");
  });
});
