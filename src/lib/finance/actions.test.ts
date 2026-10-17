import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinancialEvent, NewFinancialEvent } from "./types";
const state = vi.hoisted(() => ({ events: [] as FinancialEvent[] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireOwnerId: async () => "test-owner" }));
vi.mock("./repository", () => ({ getFinancialEventRepository: () => ({
  listEvents: async () => state.events.map((e) => ({ ...e })),
  createEvent: async (input: NewFinancialEvent) => { const event = { ...input, id: crypto.randomUUID() }; state.events.push(event); return event; },
  updateEvent: async (id: string, patch: Partial<FinancialEvent>) => { const i = state.events.findIndex((e) => e.id === id); if (i < 0) throw new Error("not found"); return state.events[i] = { ...state.events[i], ...patch }; },
  deleteEvent: async (id: string) => { state.events = state.events.filter((e) => e.id !== id); },
}) }));
import { createTransaction, markBillPaid, updateTransaction, planWishlistSavings, addWishlistContribution } from "./actions";
import { settleLedgerAmount } from "./ledger";
import { revalidatePath } from "next/cache";
import { addWishlistGoal } from "./wishlist-goals";
const bill: FinancialEvent = { id: "bill", date: "2026-10-20T00:00:00.000Z", amount: 100, direction: "expense", record: "planned", certainty: "certain", recurrence: "recurring", source: "manual", category: "Utilities", counterparty: "Energy" };
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
beforeEach(() => { state.events = []; vi.clearAllMocks(); });
describe("connected financial actions", () => {
  it("renews a monthly bill when paid, without renewing a second time", async () => {
    state.events = [{ ...bill }];
    await markBillPaid(form({ id: "bill" }));
    expect(state.events[0].record).toBe("actual");
    expect(state.events[1]).toMatchObject({ date: "2026-11-20T00:00:00.000Z", record: "planned", amount: 100 });
    await expect(markBillPaid(form({ id: "bill" }))).rejects.toThrow();
    expect(state.events).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("keeps partial repayment amounts exact and marks full repayment certain", async () => {
    state.events = [{ ...bill, category: "Repayment", recurrence: "one-time", direction: "income", certainty: "uncertain" }];
    await settleLedgerAmount("bill", 30.01);
    expect(state.events[0].amount).toBe(69.99);
    expect(state.events[1]).toMatchObject({ amount: 30.01, record: "actual", certainty: "certain" });
    await settleLedgerAmount("bill", 69.99);
    expect(state.events[0]).toMatchObject({ record: "actual", certainty: "certain" });
    await expect(settleLedgerAmount("bill", 1)).rejects.toThrow();
  });
  it.each([-1, 0, NaN, Infinity, 101])("rejects invalid ledger payment %s", async (amount) => {
    state.events = [{ ...bill, category: "Repayment" }];
    await expect(settleLedgerAmount("bill", amount)).rejects.toThrow();
    expect(state.events[0].amount).toBe(100);
  });
  it("cannot settle a non-ledger event", async () => {
    state.events = [{ ...bill }];
    await expect(settleLedgerAmount("bill", 100)).rejects.toThrow();
  });
  it("edits an actual transaction while preserving Nessie provenance", async () => {
    state.events = [{ ...bill, record: "actual", source: "nessie", sourceRecordId: "external" }];
    await updateTransaction(form({ id: "bill", date: "2026-10-15", amount: "12.34", direction: "expense", counterparty: "Updated", category: "Dining" }));
    expect(state.events[0]).toMatchObject({ amount: 12.34, counterparty: "Updated", source: "nessie", sourceRecordId: "external" });
  });
  it("rejects impossible dates and sub-cent amounts", async () => {
    await expect(createTransaction(form({ date: "2026-02-31", amount: "10", direction: "expense" }))).rejects.toThrow();
    await expect(createTransaction(form({ date: "2026-10-17", amount: "0.001", direction: "expense" }))).rejects.toThrow();
    expect(state.events).toHaveLength(0);
  });
  it("creates a capped savings schedule and consumes planned reserves when contributing", async () => {
    const target = new Date(); target.setUTCDate(target.getUTCDate() + 14);
    const goal = addWishlistGoal("test-owner", { name: "Test trip", targetAmount: 100, targetDate: target.toISOString() });
    await planWishlistSavings(form({ goalId: goal.id, weeklyAmount: "60" }));
    expect(state.events.map((e) => e.amount)).toEqual([60, 40]);
    await addWishlistContribution(form({ goalName: goal.name, amount: "25" }));
    expect(state.events.filter((e) => e.record === "planned").reduce((sum, e) => sum + e.amount, 0)).toBe(75);
    expect(state.events.find((e) => e.record === "actual")?.amount).toBe(25);
  });
});
