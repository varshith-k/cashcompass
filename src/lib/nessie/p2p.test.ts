import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancialEvent, NewFinancialEvent } from "@/lib/finance/types";

const ME = "a".repeat(24);
const SAM = "b".repeat(24);
const STRANGER = "c".repeat(24);

const state = vi.hoisted(() => ({ events: [] as FinancialEvent[] }));
vi.mock("@/lib/finance/repository", () => ({
  withFinancialTransaction: async (work: (ownerId: string) => Promise<unknown>) => work("p2p-test"),
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
    deleteEvent: async (id: string) => {
      state.events = state.events.filter((e) => e.id !== id);
    },
  }),
}));
vi.mock("./client", () => ({
  getAccount: async (id: string) => ({ _id: id, nickname: id === ME ? "My Checking" : "Stranger's Savings", balance: 500 }),
  getAccountPurchases: async () => [],
  getAccountDeposits: async () => [],
  getAccountWithdrawals: async () => [],
  getAccountBills: async () => [],
  getMerchant: async () => ({ name: "Shop" }),
  getAccountTransfers: vi.fn(),
}));

import { getAccountTransfers } from "./client";
import { syncNessieAccount } from "./sync";

const transfer = (overrides: Record<string, unknown>) => ({
  _id: "t1",
  type: "p2p",
  transaction_date: "2026-10-16",
  status: "completed",
  medium: "balance",
  payer_id: SAM,
  payee_id: ME,
  amount: 150,
  description: "Rent split",
  ...overrides,
});

beforeEach(() => {
  state.events = [];
});

describe("Nessie P2P transfers", () => {
  it("imports received and sent transfers as settle-up payments, linked to the friend", async () => {
    vi.mocked(getAccountTransfers).mockResolvedValue([
      transfer({ _id: "in" }),
      transfer({ _id: "out", payer_id: ME, payee_id: STRANGER, amount: 40 }),
      transfer({ _id: "gone", status: "cancelled" }),
    ]);
    await syncNessieAccount(ME, { friends: [{ id: "friend-sam", name: "Sam (roommate)", nessieAccountId: SAM }] });

    expect(state.events).toHaveLength(2);
    expect(state.events.find((e) => e.sourceRecordId === `${ME}/transfer/in`)).toMatchObject({
      direction: "income", amount: 150, category: "Repayment", record: "actual", source: "nessie", counterparty: "Sam (roommate)", friendId: "friend-sam",
    });
    expect(state.events.find((e) => e.sourceRecordId === `${ME}/transfer/out`)).toMatchObject({
      direction: "expense", amount: 40, counterparty: "Stranger's Savings",
    });
  });

  it("matches a transfer already recorded by Pay with Nessie instead of duplicating it", async () => {
    state.events = [{
      id: "settled", date: "2026-10-16T00:00:00.000Z", amount: 60, direction: "expense", record: "actual", certainty: "certain",
      recurrence: "one-time", source: "nessie", category: "Repayment", counterparty: "Sam (roommate)", friendId: "friend-sam",
      sourceRecordId: `${ME}/transfer/paid-in-app`,
    }];
    vi.mocked(getAccountTransfers).mockResolvedValue([transfer({ _id: "paid-in-app", payer_id: ME, payee_id: SAM, amount: 60 })]);
    const result = await syncNessieAccount(ME, { friends: [{ id: "friend-sam", name: "Sam (roommate)", nessieAccountId: SAM }] });

    expect(state.events).toHaveLength(1);
    expect(result.added).toBe(0);
  });
});
