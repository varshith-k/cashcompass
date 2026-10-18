import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinancialEvent, NewFinancialEvent } from "@/lib/finance/types";
const state = vi.hoisted(() => ({ events: [] as FinancialEvent[] }));
vi.mock("@/lib/finance/repository", () => ({ getFinancialEventRepository: () => ({
  listEvents: async () => state.events.map((e) => ({ ...e })),
  createEvent: async (input: NewFinancialEvent) => { const event = { ...input, id: crypto.randomUUID() }; state.events.push(event); return event; },
  updateEvent: async (id: string, patch: NewFinancialEvent) => { const index = state.events.findIndex((e) => e.id === id); return state.events[index] = { ...state.events[index], ...patch }; },
}) }));
vi.mock("./client", () => ({
  getAccount: async () => ({ _id: "account", nickname: "Test", balance: 500 }),
  getAccountPurchases: vi.fn(), getAccountDeposits: async () => [], getAccountWithdrawals: async () => [], getAccountBills: async () => [], getMerchant: async () => ({ name: "Coffee" }),
}));
import { getAccountPurchases } from "./client";
import { syncNessieAccount } from "./sync";
const purchase = { _id: "p1", merchant_id: "m1", amount: 5, purchase_date: "2026-10-17", status: "completed", description: "Coffee" };
beforeEach(() => { state.events = []; vi.mocked(getAccountPurchases).mockResolvedValue([purchase]); });
describe("Nessie synchronization", () => {
  it("imports each record once without duplicating the store", async () => {
    expect((await syncNessieAccount("account")).added).toBe(1);
    expect(state.events).toHaveLength(1);
    expect((await syncNessieAccount("account")).skipped).toBe(1);
    expect(state.events).toHaveLength(1);
  });
  it("preserves distinct same-day purchases of the same amount", async () => {
    vi.mocked(getAccountPurchases).mockResolvedValue([purchase, { ...purchase, _id: "p2" }]);
    expect((await syncNessieAccount("account")).added).toBe(2);
  });
  it("treats a pending card purchase as already spent, not as a bill, and doesn't duplicate it when it completes", async () => {
    vi.mocked(getAccountPurchases).mockResolvedValue([{ ...purchase, status: "pending" }]);
    await syncNessieAccount("account");
    expect(state.events[0].record).toBe("actual");
    vi.mocked(getAccountPurchases).mockResolvedValue([purchase]);
    await syncNessieAccount("account");
    expect(state.events).toHaveLength(1);
    expect(state.events[0].record).toBe("actual");
  });
  it("does not import cancelled purchases", async () => {
    vi.mocked(getAccountPurchases).mockResolvedValue([{ ...purchase, status: "cancelled" }]);
    expect((await syncNessieAccount("account")).added).toBe(0);
  });
});
