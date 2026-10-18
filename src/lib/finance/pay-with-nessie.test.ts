import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancialEvent, NewFinancialEvent } from "./types";

const ME = "a".repeat(24);
const ALEX = "d".repeat(24);

const state = vi.hoisted(() => ({ events: [] as FinancialEvent[] }));
const nessie = vi.hoisted(() => ({ createTransfer: vi.fn(), configured: true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireOwnerId: async () => "auth0|payer", getSession: async () => null }));
vi.mock("@/lib/nessie/accounts", () => ({ listDemoAccounts: async () => ({ accounts: [{ _id: ME, nickname: "Mine", type: "Checking", balance: 900 }] }) }));
vi.mock("@/lib/nessie/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/nessie/client")>()),
  isNessieConfigured: () => nessie.configured,
  createTransfer: nessie.createTransfer,
}));
vi.mock("./repository", () => ({
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

import { addFriend } from "./friends";
import { payWithNessieTransfer } from "./settle-up-actions";

const owed = (friendId?: string): FinancialEvent => ({
  id: "owe-1", date: "2026-10-26T00:00:00.000Z", amount: 60, direction: "expense", record: "planned", certainty: "certain",
  recurrence: "one-time", source: "manual", category: "Repayment", counterparty: "Alex", friendId,
});

beforeEach(() => {
  state.events = [];
  nessie.configured = true;
  nessie.createTransfer.mockReset();
});

describe("Pay with Nessie", () => {
  it("sends a P2P transfer from my account to the friend's and settles the balance, linked to the transfer", async () => {
    const alex = await addFriend("auth0|payer", { name: "Alex P2P", nessieAccountId: ALEX });
    state.events = [owed(alex.id)];
    nessie.createTransfer.mockResolvedValue({ _id: "tx123" });

    const result = await payWithNessieTransfer("owe-1");

    expect(result.ok).toBe(true);
    expect(nessie.createTransfer).toHaveBeenCalledWith(ME, expect.objectContaining({ payeeAccountId: ALEX, amount: 60 }));
    expect(state.events[0]).toMatchObject({ record: "actual", source: "nessie", sourceRecordId: `${ME}/transfer/tx123` });
  });

  it("records nothing when Nessie rejects the transfer", async () => {
    const alex = await addFriend("auth0|payer", { name: "Alex Rejected", nessieAccountId: ALEX });
    state.events = [owed(alex.id)];
    nessie.createTransfer.mockRejectedValue(new Error("400"));

    expect((await payWithNessieTransfer("owe-1")).ok).toBe(false);
    expect(state.events[0]).toMatchObject({ record: "planned" });
  });

  it("refuses without a friend Nessie account or when Nessie isn't configured", async () => {
    state.events = [owed(undefined)];
    expect((await payWithNessieTransfer("owe-1")).ok).toBe(false);
    nessie.configured = false;
    expect((await payWithNessieTransfer("owe-1")).message).toMatch(/NESSIE_API_KEY/);
    expect(nessie.createTransfer).not.toHaveBeenCalled();
  });
});
