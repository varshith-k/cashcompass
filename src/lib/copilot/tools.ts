import {
  computeForecast,
  countBillsAtRisk,
  recommendedWeeklyContribution,
  savingsProgressForGoal,
  selectUpcomingBills,
  summarizeForecast,
} from "@/lib/finance/calculations";
import { buildPurchaseEvent, buildShiftedEvent } from "@/lib/finance/scenarios";
import type { FinancialEvent } from "@/lib/finance/types";
import type { WishlistGoal } from "@/lib/finance/wishlist-goals";
import type { BudgetAllocation } from "@/lib/finance/budgets";

/**
 * Deterministic tools the copilot calls instead of ever computing a
 * number itself — Gemini (or the offline fallback) explains these
 * results, it never invents its own. Every tool reuses the same
 * calculations the dashboard and cash-flow simulator run.
 */

export interface ForecastContext {
  events: FinancialEvent[];
  /** The signed-in user's budgets and goals, loaded server-side in askCopilot. */
  budgets: BudgetAllocation[];
  wishlistGoals: WishlistGoal[];
  openingBalance: number;
  balanceDescription?: string;
  bufferThreshold: number;
  forecastDays: number;
  historyDays: number;
  nextPaydayDate: string | null;
}

function startDateFor(historyDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - historyDays);
  return d;
}

export interface AffordabilityResult {
  affordable: boolean;
  minBalance: number;
  conservativeMinBalance: number;
  bufferThreshold: number;
  billsAtRisk: number;
  totalBills: number;
  purchaseDate: string;
}

export function checkAffordability(
  ctx: ForecastContext,
  purchase: { amount: number; label: string; date: string },
): AffordabilityResult {
  if (!Number.isFinite(purchase.amount) || purchase.amount <= 0) throw new Error("Purchase amount must be positive");
  const purchaseEvent = buildPurchaseEvent(purchase);
  const points = computeForecast(ctx.openingBalance, ctx.events.concat(purchaseEvent), {
    days: ctx.forecastDays,
    startDate: startDateFor(ctx.historyDays),
    lowBalanceThreshold: ctx.bufferThreshold,
  });
  const summary = summarizeForecast(points.slice(ctx.historyDays));
  const bills = selectUpcomingBills(ctx.events);
  return {
    affordable: points.slice(ctx.historyDays).every((point) => point.conservativeBalance >= ctx.bufferThreshold),
    conservativeMinBalance: Math.min(...points.slice(ctx.historyDays).map((p) => p.conservativeBalance)),
    minBalance: summary.minBalance,
    bufferThreshold: ctx.bufferThreshold,
    billsAtRisk: countBillsAtRisk(bills, points),
    totalBills: bills.length,
    purchaseDate: purchase.date,
  };
}

export function compareBuyTimings(ctx: ForecastContext, purchase: { amount: number; label: string }) {
  return {
    now: checkAffordability(ctx, { ...purchase, date: new Date().toISOString() }),
    afterPayday: ctx.nextPaydayDate ? checkAffordability(ctx, { ...purchase, date: ctx.nextPaydayDate }) : null,
  };
}

export interface RepaymentDelayResult {
  found: boolean;
  counterparty?: string;
  originalDate?: string;
  newDate?: string;
  minBalance: number;
  bufferThreshold: number;
  billsAtRisk: number;
  totalBills: number;
}

export function checkRepaymentDelay(
  ctx: ForecastContext,
  match: { counterpartyContains?: string; delayDays: number },
): RepaymentDelayResult {
  const repayments = ctx.events.filter((e) => e.record === "planned" && e.direction === "income" && e.certainty === "uncertain" && e.category === "Repayment");
  const original = match.counterpartyContains
    ? repayments.find((r) => r.counterparty.toLowerCase().includes(match.counterpartyContains!.toLowerCase()))
    : repayments[0];

  if (!original) {
    return { found: false, minBalance: 0, bufferThreshold: ctx.bufferThreshold, billsAtRisk: 0, totalBills: 0 };
  }

  const shifted = buildShiftedEvent(original, match.delayDays);
  const layeredEvents = ctx.events.filter((e) => e.id !== original.id).concat(shifted);
  const points = computeForecast(ctx.openingBalance, layeredEvents, {
    days: ctx.forecastDays,
    startDate: startDateFor(ctx.historyDays),
    lowBalanceThreshold: ctx.bufferThreshold,
  });
  const summary = summarizeForecast(points.slice(ctx.historyDays));
  const bills = selectUpcomingBills(ctx.events);

  return {
    found: true,
    counterparty: original.counterparty,
    originalDate: original.date,
    newDate: shifted.date,
    minBalance: summary.minBalance,
    bufferThreshold: ctx.bufferThreshold,
    billsAtRisk: countBillsAtRisk(bills, points),
    totalBills: bills.length,
  };
}

export interface SavingsPlanResult {
  found: boolean;
  goalName?: string;
  targetAmount?: number;
  saved?: number;
  weeklyAmount?: number;
  targetDate?: string;
}

export function suggestSavingsPlan(
  events: FinancialEvent[],
  goals: WishlistGoal[],
  nameContains?: string,
): SavingsPlanResult {
  const goal = nameContains
    ? goals.find((g) => g.name.toLowerCase().includes(nameContains.toLowerCase()))
    : goals[0];
  if (!goal) return { found: false };

  const saved = savingsProgressForGoal(events, goal.name);
  return {
    found: true,
    goalName: goal.name,
    targetAmount: goal.targetAmount,
    saved,
    weeklyAmount: recommendedWeeklyContribution(goal.targetAmount - saved, goal.targetDate),
    targetDate: goal.targetDate,
  };
}

export interface SpendingBreakdownResult {
  overBudget: { category: string; spent: number; limit: number }[];
  topCategories: { category: string; spent: number }[];
}

export function spendingBreakdown(
  spendByCategory: Map<string, number>,
  budgets: BudgetAllocation[],
): SpendingBreakdownResult {
  const overBudget = budgets
    .map((b) => ({ category: b.category, spent: spendByCategory.get(b.category) ?? 0, limit: b.monthlyLimit }))
    .filter((b) => b.spent > b.limit);

  const topCategories = Array.from(spendByCategory.entries())
    .map(([category, spent]) => ({ category, spent }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  return { overBudget, topCategories };
}
