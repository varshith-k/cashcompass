import { spendByCategoryThisMonth } from "@/lib/finance/calculations";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  checkAffordability,
  checkRepaymentDelay,
  compareBuyTimings,
  spendingBreakdown,
  suggestSavingsPlan,
  type ForecastContext,
} from "./tools";
import type { CopilotResult } from "./types";

function extractAmount(message: string): number | null {
  const match = message.match(/\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function extractDays(message: string, fallback: number): number {
  const digitMatch = message.match(/(\d+)\s*day/i)?.[1];
  if (digitMatch) return Number(digitMatch);

  const wordMatch = message.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*days?/);
  if (wordMatch) return WORD_NUMBERS[wordMatch[1]];

  return fallback;
}

/** Finds the ledger entry a free-text message is actually referring to, by overlapping words with its counterparty name — not by guessing at capitalization. */
function matchCounterparty<T extends { counterparty: string }>(message: string, entries: T[]): T | undefined {
  const lower = message.toLowerCase();
  return entries.find((entry) =>
    entry.counterparty
      .toLowerCase()
      .split(/\W+/)
      .some((word) => word.length > 2 && lower.includes(word)),
  );
}

function extractLabel(message: string, amount: number): string {
  // Best-effort: the word right after the amount, if any, e.g. "$1,200 MacBook".
  const idx = message.indexOf(String(Math.trunc(amount)));
  const after = idx >= 0 ? message.slice(idx).replace(/^\$?[\d,.]+/, "").trim() : "";
  const word = after.split(/\s+/).find((w) => /^[a-zA-Z]+$/.test(w));
  return word || "this purchase";
}

/**
 * Runs without Gemini: a small keyword classifier picks one deterministic
 * tool and the reply is built entirely from that tool's real numbers.
 * Grounded by construction — there's nothing here that could invent a
 * balance or a projection, since there's no model generating prose.
 */
export function respondOffline(message: string, ctx: ForecastContext): CopilotResult {
  const lower = message.toLowerCase();
  const amount = extractAmount(message);

  if (lower.includes("overspen") || lower.includes("where") && lower.includes("month")) {
    const spend = spendByCategoryThisMonth(ctx.events);
    const { overBudget, topCategories } = spendingBreakdown(spend, ctx.budgets);

    if (overBudget.length > 0) {
      const lines = overBudget.map(
        (b) => `${b.category}: ${formatCurrency(b.spent, { cents: true })} of ${formatCurrency(b.limit)}`,
      );
      return {
        reply: `You're over budget in ${overBudget.length} ${overBudget.length === 1 ? "category" : "categories"} this month: ${lines.join("; ")}.`,
        assumptions: ["Based on actual transactions recorded this month against your current budget limits."],
        actionLabel: "Review budgets",
        actionHref: "/budgets",
      };
    }

    const topLine = topCategories.map((c) => `${c.category} (${formatCurrency(c.spent, { cents: true })})`).join(", ");
    return {
      reply: topCategories.length > 0
        ? `Nothing's over budget. Your biggest categories this month so far: ${topLine}.`
        : "No actual spending recorded yet this month.",
      assumptions: ["Based on actual transactions recorded this month."],
      actionLabel: "View transactions",
      actionHref: "/transactions",
    };
  }

  if ((lower.includes("late") || lower.includes("roommate")) && lower.includes("pay")) {
    const delayDays = extractDays(message, 5);
    const repayments = ctx.events.filter((e) => e.certainty === "uncertain" && e.category === "Repayment");
    const matched = matchCounterparty(message, repayments);
    const result = checkRepaymentDelay(ctx, { counterpartyContains: matched?.counterparty, delayDays });

    if (!result.found) {
      return {
        reply: "I don't see an uncertain repayment on your ledger to test that against. Add one on the Money Owed/Lent page first.",
        assumptions: [],
        actionLabel: "Go to ledger",
        actionHref: "/ledger",
      };
    }

    return {
      reply: `If ${result.counterparty}'s repayment arrives ${delayDays} days late (${formatShortDate(result.newDate!)} instead of ${formatShortDate(result.originalDate!)}), your projected minimum balance is ${formatCurrency(result.minBalance, { cents: true })} — ${result.minBalance >= result.bufferThreshold ? "still above" : "below"} your ${formatCurrency(result.bufferThreshold)} buffer. ${result.billsAtRisk} of ${result.totalBills} upcoming bills would be at risk.`,
      assumptions: [`Assumes the delay is the only change to your real baseline.`],
      actionLabel: "Open the simulator",
      actionHref: "/cash-flow",
    };
  }

  if (lower.includes("save") || lower.includes("saving")) {
    const nameMatch = message.match(/for (?:my |the )?([a-z\s]+?)(?:\.|$)/i)?.[1]?.trim();
    const goals = ctx.wishlistGoals;
    const plan = suggestSavingsPlan(ctx.events, goals, nameMatch);

    if (!plan.found) {
      return {
        reply: "You don't have a wishlist goal set up yet — add one and I can tell you exactly how much to save each week.",
        assumptions: [],
        actionLabel: "Add a goal",
        actionHref: "/wishlist",
      };
    }

    if (amount && lower.includes("without risking")) {
      const check = checkAffordability(ctx, { amount, label: "a savings contribution", date: new Date().toISOString() });
      return {
        reply: `Setting aside ${formatCurrency(amount)} today ${check.affordable ? "keeps" : "would drop"} your projected minimum balance ${check.affordable ? "above" : "below"} your ${formatCurrency(check.bufferThreshold)} buffer (projected minimum: ${formatCurrency(check.minBalance, { cents: true })}). ${check.billsAtRisk} of ${check.totalBills} upcoming bills would be at risk.`,
        assumptions: ["Treats the amount as a one-time savings transfer happening today."],
        actionLabel: "Open the simulator",
        actionHref: "/cash-flow",
      };
    }

    return {
      reply: `For "${plan.goalName}" (${formatCurrency(plan.targetAmount!)} by ${formatShortDate(plan.targetDate!)}), you've saved ${formatCurrency(plan.saved!, { cents: true })} so far. Saving ${formatCurrency(plan.weeklyAmount!)}/week gets you there on time.`,
      assumptions: ["Spreads the remaining amount evenly across the weeks left until your target date."],
      actionLabel: "View goal",
      actionHref: "/wishlist",
    };
  }

  if (amount && (lower.includes("afford") || lower.includes("buy") || lower.includes("rent") || lower.includes("purchase"))) {
    const label = extractLabel(message, amount);
    const { now, afterPayday } = compareBuyTimings(ctx, { amount, label });

    return {
      reply: `Buying ${label} today for ${formatCurrency(amount)} leaves a projected minimum balance of ${formatCurrency(now.minBalance, { cents: true })} (${now.affordable ? "above" : "below"} your ${formatCurrency(now.bufferThreshold)} buffer, ${now.billsAtRisk}/${now.totalBills} bills at risk). Waiting until your next payday changes that to ${formatCurrency(afterPayday.minBalance, { cents: true })} (${afterPayday.billsAtRisk}/${afterPayday.totalBills} bills at risk).`,
      assumptions: ["Compares the purchase happening today against it happening on your next payday, with everything else held the same."],
      actionLabel: "Compare in the simulator",
      actionHref: "/cash-flow",
    };
  }

  return {
    reply: "I can check whether a purchase is affordable, compare buying now vs. after payday, suggest a weekly savings amount for a goal, test a late repayment, or show where you overspent this month. Try one of the prompts above, or ask with a specific dollar amount.",
    assumptions: [],
  };
}
