import { describe, expect, it } from "vitest";

import { getBudgets, setBudgetLimits } from "@/lib/finance/budgets";
import { DemoFinancialEventStore } from "@/lib/finance/demo-repository";
import type { NewFinancialEvent } from "@/lib/finance/types";
import { addWishlistGoal, deleteWishlistGoal, getWishlistGoals } from "@/lib/finance/wishlist-goals";
import { getSyncStatus, recordSyncStatus } from "@/lib/nessie/status";

const ALICE = "auth0|alice";
const BOB = "google-oauth2|bob";

const coffee: NewFinancialEvent = {
  date: new Date().toISOString(),
  amount: 4.5,
  direction: "expense",
  record: "actual",
  certainty: "certain",
  recurrence: "one-time",
  source: "manual",
  category: "Dining",
  counterparty: "Alice's coffee",
};

describe("financial events are isolated per user", () => {
  it("keeps each user's writes out of other users' lists", async () => {
    const store = new DemoFinancialEventStore();
    const created = await store.createEvent(ALICE, coffee);

    expect((await store.listEvents(ALICE)).some((e) => e.id === created.id)).toBe(true);
    expect((await store.listEvents(BOB)).some((e) => e.id === created.id)).toBe(false);
  });

  it("refuses to update or delete another user's event by id", async () => {
    const store = new DemoFinancialEventStore();
    const created = await store.createEvent(ALICE, coffee);

    await expect(store.updateEvent(BOB, created.id, { amount: 9999 })).rejects.toThrow(/not found/);
    await store.deleteEvent(BOB, created.id);

    const alices = await store.listEvents(ALICE);
    expect(alices.find((e) => e.id === created.id)?.amount).toBe(4.5);
  });

  it("gives every new user their own copy of the demo data", async () => {
    const store = new DemoFinancialEventStore();
    const first = (await store.listEvents("auth0|new-1"))[0]!;
    await store.deleteEvent("auth0|new-1", first.id);

    expect((await store.listEvents("auth0|new-2")).some((e) => e.id === first.id)).toBe(true);
  });
});

describe("budgets, goals and sync status are isolated per user", () => {
  it("budgets", () => {
    setBudgetLimits(ALICE, { Dining: 999 });
    expect(getBudgets(ALICE).find((b) => b.category === "Dining")?.monthlyLimit).toBe(999);
    expect(getBudgets(BOB).find((b) => b.category === "Dining")?.monthlyLimit).toBe(150);
  });

  it("wishlist goals", () => {
    const goal = addWishlistGoal(ALICE, { name: "Alice's bike", targetAmount: 500, targetDate: new Date().toISOString() });
    expect(getWishlistGoals(BOB).some((g) => g.id === goal.id)).toBe(false);

    deleteWishlistGoal(BOB, goal.id);
    expect(getWishlistGoals(ALICE).some((g) => g.id === goal.id)).toBe(true);
  });

  it("Nessie sync status", () => {
    recordSyncStatus(ALICE, { added: 3, skipped: 0 });
    expect(getSyncStatus(ALICE)?.added).toBe(3);
    expect(getSyncStatus(BOB)).toBeNull();
  });
});
