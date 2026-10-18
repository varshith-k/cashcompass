import { describe, expect, it } from "vitest";
import { DemoFinancialEventStore } from "@/lib/finance/demo-repository";
import { getBudgets, setBudgetLimits } from "@/lib/finance/budgets";
import { claimSettlement } from "@/lib/solana/receipts";
import { withOwnerTransaction } from "./transaction";

const expense = { date: new Date().toISOString(), amount: 25, direction: "expense" as const, record: "actual" as const, certainty: "certain" as const, recurrence: "one-time" as const, source: "manual" as const, category: "Dining", counterparty: "Rollback test" };
describe("memory transaction parity", () => {
  it("rolls back events, planning and receipt claims as one operation", async () => {
    const owner = crypto.randomUUID();
    const signature = crypto.randomUUID();
    const store = new DemoFinancialEventStore();
    const before = await store.listEvents(owner);
    await expect(withOwnerTransaction(owner, async () => {
      await store.createEvent(owner, expense);
      await setBudgetLimits(owner, { Dining: 1 });
      expect(await claimSettlement(signature, owner, "entry")).toBe(true);
      throw new Error("simulate failed write");
    })).rejects.toThrow("simulate failed write");
    expect(await store.listEvents(owner)).toEqual(before);
    expect((await getBudgets(owner)).find((b) => b.category === "Dining")?.monthlyLimit).toBe(150);
    expect(await claimSettlement(signature, owner, "entry")).toBe(true);
  });
  it("serializes concurrent writes without losing a committed transaction", async () => {
    const owner = crypto.randomUUID();
    await Promise.all([100, 200, 300].map((limit) => withOwnerTransaction(owner, async () => {
      await setBudgetLimits(owner, { Dining: limit });
      await new Promise((resolve) => setTimeout(resolve, 2));
    })));
    expect((await getBudgets(owner)).find((b) => b.category === "Dining")?.monthlyLimit).toBe(300);
  });
  it("rejects cross-owner operations inside a transaction", async () => {
    await expect(withOwnerTransaction("alice-transaction", () => setBudgetLimits("bob-transaction", { Dining: 1 }))).rejects.toThrow("owner mismatch");
  });
});
