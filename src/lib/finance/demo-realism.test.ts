import { describe, expect, it } from "vitest";

import { purchaseLabel, respondOffline } from "@/lib/copilot/respond-offline";
import { compareBuyTimings, type ForecastContext } from "@/lib/copilot/tools";
import { getBudgets } from "@/lib/finance/budgets";
import {
  computeAvailableBalance,
  computeForecast,
  computeSafeToSpend,
  estimateDailySpend,
  findNextPayday,
  safeToSpendWindow,
} from "@/lib/finance/calculations";
import { DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE, getDemoEvents } from "@/lib/finance/demo-data";
import type { FinancialEvent } from "@/lib/finance/types";
import { getWishlistGoals } from "@/lib/finance/wishlist-goals";
import { categorizeExpense } from "@/lib/nessie/categorize";

function daysFromToday(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function event(overrides: Partial<FinancialEvent>): FinancialEvent {
  return {
    id: crypto.randomUUID(),
    date: daysFromToday(0),
    amount: 10,
    direction: "expense",
    record: "actual",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: "Groceries",
    counterparty: "Store",
    ...overrides,
  };
}

async function demoContext(): Promise<ForecastContext> {
  const events = getDemoEvents();
  return {
    events,
    budgets: await getBudgets("demo-test"),
    wishlistGoals: await getWishlistGoals("demo-test"),
    openingBalance: DEMO_STARTING_BALANCE,
    bufferThreshold: DEMO_PREFERRED_BUFFER,
    forecastDays: 35,
    historyDays: 5,
    nextPaydayDate: findNextPayday(events)?.date ?? null,
    dailySpend: estimateDailySpend(events),
  };
}

describe("demo data tells the CashCompass story", () => {
  it("has $2,250 today, but a $1,200 purchase today puts rent at risk while after payday is safe", async () => {
    const ctx = await demoContext();
    expect(computeAvailableBalance(ctx.openingBalance, ctx.events)).toBe(2250);
    const { now, afterPayday } = compareBuyTimings(ctx, { amount: 1200, label: "MacBook" });
    expect(now.affordable).toBe(false);
    expect(now.billsAtRisk).toBeGreaterThan(0);
    expect(afterPayday?.affordable).toBe(true);
  });

  it("is on track without the purchase (no buffer breach in the baseline forecast)", async () => {
    const ctx = await demoContext();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - ctx.historyDays);
    const points = computeForecast(ctx.openingBalance, ctx.events, { days: ctx.forecastDays, startDate: start, lowBalanceThreshold: ctx.bufferThreshold, dailySpend: ctx.dailySpend });
    expect(points.slice(ctx.historyDays).some((p) => p.isLowBalanceRisk)).toBe(false);
  });

  it("labels none of the made-up demo events as Nessie data", () => {
    expect(getDemoEvents().filter((e) => e.source === "nessie")).toEqual([]);
  });
});

describe("everyday spending estimate", () => {
  it("averages recent everyday purchases and ignores bills, savings and debts", () => {
    const events = [
      event({ amount: 70, date: daysFromToday(-13) }),
      event({ amount: 70, date: daysFromToday(-1), category: "Dining" }),
      event({ amount: 1250, category: "Housing" }),
      event({ amount: 50, category: "Savings" }),
      event({ amount: 99, category: "Repayment" }),
      event({ amount: 500, date: daysFromToday(-60) }),
      event({ amount: 40, record: "planned", date: daysFromToday(2) }),
    ];
    expect(estimateDailySpend(events)).toBe(10); // $140 over 14 days
  });

  it("divides by at least a week so one purchase can't spike the rate", () => {
    expect(estimateDailySpend([event({ amount: 70 })])).toBe(10);
    expect(estimateDailySpend([])).toBe(0);
  });

  it("is subtracted on future days only", () => {
    const start = new Date(daysFromToday(-2));
    const points = computeForecast(1000, [], { days: 5, startDate: start, lowBalanceThreshold: 0, dailySpend: 10 });
    expect(points.map((p) => p.projectedBalance)).toEqual([1000, 1000, 1000, 990, 980]);
  });
});

describe("Safe to Spend window", () => {
  it("only holds back bills, savings, debts and everyday spending due before the next paycheck", () => {
    const events = [
      event({ category: "Payroll", direction: "income", record: "planned", amount: 1500, date: daysFromToday(10) }),
      event({ category: "Housing", record: "planned", amount: 1000, date: daysFromToday(3) }),
      event({ category: "Utilities", record: "planned", amount: 80, date: daysFromToday(15) }),
      event({ category: "Savings", record: "planned", amount: 50, date: daysFromToday(5) }),
      event({ category: "Savings", record: "planned", amount: 500, date: daysFromToday(40) }),
      event({ category: "Repayment", record: "planned", amount: 60, date: daysFromToday(8) }),
    ];
    const window = safeToSpendWindow(events, 20);
    expect(window).toMatchObject({ bills: 1000, savings: 50, debtsOwed: 60, everydaySpending: 200 });
    const { safeToSpend } = computeSafeToSpend({ availableBalance: 2000, upcomingBills: window.bills, savingsEarmarks: window.savings, debtsOwed: window.debtsOwed, everydaySpending: window.everydaySpending, preferredBuffer: 300 });
    expect(safeToSpend).toBe(390);
  });
});

describe("recurring paychecks", () => {
  it("repeat through the forecast like recurring bills", () => {
    const start = new Date(daysFromToday(0));
    const payday = event({ category: "Payroll", direction: "income", record: "planned", recurrence: "recurring", amount: 100, date: daysFromToday(1) });
    const points = computeForecast(0, [payday], { days: 70, startDate: start, lowBalanceThreshold: 0 });
    expect(points.at(-1)!.projectedBalance).toBeGreaterThanOrEqual(200);
  });
});

describe("offline copilot wording", () => {
  it.each([
    ["Can I buy AirPods for 199 dollars", "AirPods"],
    ["Can I afford a MacBook for $1,200?", "MacBook"],
    ["Can I afford a $1,200 MacBook today?", "MacBook"],
    ["can i get new headphones for $89.99 right now", "headphones"],
    ["Can I afford $40 today?", "this purchase"],
  ])("%s -> %s", (message, label) => {
    expect(purchaseLabel(message, message.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/))).toBe(label);
  });

  it("never says 'Buying this purchase'", async () => {
    expect(respondOffline("Can I afford $40 today?", await demoContext()).reply).toMatch(/^Spending \$40 today/);
  });

  it("answers a rent question without an amount with the real next rent payment", async () => {
    const reply = respondOffline("Will I have enough money for rent after this purchase?", await demoContext()).reply;
    expect(reply).toContain("Tell me the amount");
    expect(reply).toContain("Lakeview Apartments");
  });
});

describe("Nessie categories", () => {
  it.each([
    [["Food"], "Chipotle", "Dining"],
    [undefined, "Publix Super Market", "Groceries"],
    [undefined, "Shell Oil", "Transportation"],
    [undefined, "Netflix.com", "Subscriptions"],
    [undefined, "Mystery Shop", "Other"],
  ])("%s %s -> %s", (tags, name, category) => {
    expect(categorizeExpense(tags as string[] | undefined, name)).toBe(category);
  });
});
