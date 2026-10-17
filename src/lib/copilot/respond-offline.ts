import { spendByCategoryThisMonth } from "@/lib/finance/calculations";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { checkAffordability, checkRepaymentDelay, compareBuyTimings, spendingBreakdown, suggestSavingsPlan, type ForecastContext } from "./tools";
import type { CopilotResult } from "./types";

export type CopilotTool = "check_affordability" | "check_repayment_delay" | "suggest_savings_plan" | "spending_breakdown";
const ASSUMPTIONS = [
  "Demo forecast from a seeded opening balance and recorded events; unlisted daily spending is excluded.",
  "Monthly bills repeat. Expected repayments may not arrive; affordability also checks the balance without that income.",
  "Comparisons cover the visible forecast only and do not change your records.",
];

function positiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.01 || value > 9999999999.99) throw new Error("Invalid purchase amount");
  return Math.round(value * 100) / 100;
}

/** All financial prose and cards come from deterministic tool results. */
export function respondToTool(name: CopilotTool, args: Record<string, unknown>, ctx: ForecastContext): CopilotResult {
  if (name === "spending_breakdown") {
    const { overBudget, topCategories } = spendingBreakdown(spendByCategoryThisMonth(ctx.events), ctx.budgets);
    return {
      reply: overBudget.length
        ? `You're over budget in ${overBudget.length} ${overBudget.length === 1 ? "category" : "categories"}: ${overBudget.map((b) => `${b.category}: ${formatCurrency(b.spent, { cents: true })} of ${formatCurrency(b.limit)}`).join("; ")}.`
        : topCategories.length ? `Nothing is over budget. Your largest recorded categories: ${topCategories.map((c) => `${c.category} (${formatCurrency(c.spent, { cents: true })})`).join(", ")}.` : "No actual spending recorded yet this month.",
      assumptions: ["Based on actual transactions this calendar month and your current budget limits."],
      actionLabel: "Review budgets", actionHref: "/budgets",
    };
  }
  if (name === "check_repayment_delay") {
    const delayDays = args.delayDays ?? 5;
    if (typeof delayDays !== "number" || !Number.isInteger(delayDays) || delayDays < 0 || delayDays > 365) throw new Error("Delay must be between 0 and 365 days");
    const result = checkRepaymentDelay(ctx, { delayDays, counterpartyContains: typeof args.counterpartyContains === "string" ? args.counterpartyContains : undefined });
    if (!result.found) return { reply: "I couldn't find that outstanding repayment. Add or review it in your ledger first.", assumptions: [], actionLabel: "Review ledger", actionHref: "/ledger" };
    return {
      reply: `If ${result.counterparty}'s repayment arrives ${delayDays} days late (${formatShortDate(result.newDate!)} instead of ${formatShortDate(result.originalDate!)}), your projected minimum balance is ${formatCurrency(result.minBalance, { cents: true })}. ${result.billsAtRisk} of ${result.totalBills} upcoming bills fall below your buffer when uncertain income is excluded.`,
      assumptions: ASSUMPTIONS, actionLabel: "Explore the simulator", actionHref: "/cash-flow",
    };
  }
  if (name === "suggest_savings_plan") {
    const plan = suggestSavingsPlan(ctx.events, ctx.wishlistGoals, typeof args.goalNameContains === "string" ? args.goalNameContains : undefined);
    if (!plan.found) return { reply: "I couldn't find that savings goal. Add or review a goal and its target date first.", assumptions: [], actionLabel: "Review goals", actionHref: "/wishlist" };
    const overdue = plan.targetDate!.slice(0, 10) < new Date().toISOString().slice(0, 10);
    return {
      reply: overdue ? `The target date for “${plan.goalName}” has passed. Set a new goal date before planning contributions.` : `For “${plan.goalName}” (${formatCurrency(plan.targetAmount!)} by ${formatShortDate(plan.targetDate!)}), you've reserved ${formatCurrency(plan.saved!, { cents: true })}. A plan of ${formatCurrency(plan.weeklyAmount!)}/week covers the remainder. Compare that schedule against upcoming bills before reserving funds.`,
      assumptions: ["Divides the remaining target over the weeks left. This is a proposed allocation; no money is transferred."],
      actionLabel: "View goal", actionHref: "/wishlist",
    };
  }
  const amount = positiveAmount(args.amount);
  const label = typeof args.label === "string" ? args.label.slice(0, 120) : "this purchase";
  if (args.savings === true) {
    const check = checkAffordability(ctx, { amount, label: "Savings allocation", date: new Date().toISOString() });
    return {
      reply: `Reserving ${formatCurrency(amount)} today ${check.affordable ? "keeps your forecast above" : "could put your forecast below"} your ${formatCurrency(check.bufferThreshold)} buffer. Expected minimum: ${formatCurrency(check.minBalance, { cents: true })}; without uncertain income: ${formatCurrency(check.conservativeMinBalance, { cents: true })}. ${check.billsAtRisk}/${check.totalBills} bills at risk.`,
      assumptions: ASSUMPTIONS, actionLabel: "Explore the simulator", actionHref: `/cash-flow?amount=${amount}`,
    };
  }
  const { now, afterPayday } = compareBuyTimings(ctx, { amount, label });
  return {
    reply: `Buying ${label} for ${formatCurrency(amount)} today ${now.affordable ? "keeps your forecast above" : "could reduce your forecast below"} your ${formatCurrency(now.bufferThreshold)} buffer. ${!afterPayday ? "No future payday is recorded for comparison." : afterPayday.affordable ? "Waiting until payday keeps that buffer intact." : "Waiting until payday still needs a closer look at your obligations."}`,
    assumptions: ASSUMPTIONS,
    comparison: [
      { label: "Buy today", ...now },
      ...(afterPayday ? [{ label: "Buy after payday", ...afterPayday }] : []),
    ],
    actionLabel: "Compare in the simulator", actionHref: `/cash-flow?amount=${amount}&label=${encodeURIComponent(label)}`,
  };
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function respondOffline(message: string, ctx: ForecastContext): CopilotResult {
  const lower = message.toLowerCase();
  const amountMatch = message.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const run = (name: CopilotTool, args: Record<string, unknown>) => ({ ...respondToTool(name, args, ctx), engine: "offline" as const });
  if (lower.includes("overspen") || lower.includes("where") && lower.includes("month")) return run("spending_breakdown", {});
  if ((lower.includes("late") || lower.includes("roommate")) && lower.includes("pay")) {
    const digits = message.match(/(\d+)\s*day/i)?.[1];
    const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*days?/i)?.[1];
    const entry = ctx.events.find((e) => e.category === "Repayment" && e.record === "planned" && e.direction === "income" && e.counterparty.toLowerCase().split(/\W+/).some((w) => w.length > 2 && lower.includes(w)));
    return run("check_repayment_delay", { delayDays: digits ? Number(digits) : word ? WORD_NUMBERS[word] : 5, counterpartyContains: entry?.counterparty });
  }
  if (lower.includes("save") || lower.includes("saving")) {
    if (amount && (lower.includes("without risking") || lower.includes("afford"))) return run("check_affordability", { amount, savings: true });
    const goal = ctx.wishlistGoals.find((g) => g.name.toLowerCase().split(/\W+/).some((w) => w.length > 3 && lower.includes(w)));
    return run("suggest_savings_plan", { goalNameContains: goal?.name });
  }
  if (amount && ["afford", "buy", "rent", "purchase"].some((word) => lower.includes(word))) {
    const label = amountMatch ? message.slice(amountMatch.index! + amountMatch[0].length).trim().replace(/\s+(today|now|after).*$/i, "").replace(/[?.!]+$/, "") : "this purchase";
    return run("check_affordability", { amount, label: label || "this purchase" });
  }
  return { reply: "I can compare buying now versus payday, test a late repayment, plan savings, or review spending. Ask with a specific amount or choose a suggested prompt.", assumptions: [], engine: "offline" };
}
