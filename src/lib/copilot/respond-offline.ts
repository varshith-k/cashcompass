import { computeAvailableBalance, computeSafeToSpend, safeToSpendWindow, spendByCategoryThisMonth } from "@/lib/finance/calculations";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { checkAffordability, checkRepaymentDelay, compareBuyTimings, explainPurchaseForecast, spendingBreakdown, suggestSavingsPlan, type ForecastContext } from "./tools";
import type { ChatMessage, CopilotResult } from "./types";

export type CopilotTool = "check_affordability" | "check_repayment_delay" | "suggest_savings_plan" | "spending_breakdown" | "plan_event_budget" | "explain_purchase_forecast" | "explain_capabilities";
function assumptionsFor(ctx: ForecastContext) {
  return [
    ctx.dailySpend
      ? `Includes about ${formatCurrency(ctx.dailySpend, { cents: true })}/day of everyday spending, estimated from your last 30 days of purchases.`
      : "No recent everyday spending is recorded, so none is projected.",
    "Monthly bills and paychecks repeat. Expected repayments may not arrive; affordability also checks the balance without that income.",
    "Comparisons cover the visible forecast only and do not change your records.",
  ];
}

function positiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.01 || value > 9999999999.99) throw new Error("Invalid purchase amount");
  return Math.round(value * 100) / 100;
}

/** All financial prose and cards come from deterministic tool results. */
export function respondToTool(name: CopilotTool, args: Record<string, unknown>, ctx: ForecastContext): CopilotResult {
  if (name === "explain_purchase_forecast") {
    const amount = positiveAmount(args.amount);
    if (args.timing !== "today" && args.timing !== "after_payday") throw new Error("Invalid purchase timing");
    const label = typeof args.label === "string" ? args.label.slice(0, 120) : "this purchase";
    const result = explainPurchaseForecast(ctx, { amount, label, afterPayday: args.timing === "after_payday" });
    if (!result) return { reply: "No future payday is recorded. Add your paycheck before comparing a purchase after payday.", assumptions: [], kind: "guidance" };
    return {
      reply: `Rechecking ${label} for ${formatCurrency(amount)} ${args.timing === "after_payday" ? `after payday on ${formatShortDate(result.purchaseDate)}` : "today"}: the expected minimum is ${formatCurrency(result.minimum.projectedBalance, { cents: true })} on ${formatShortDate(result.minimum.date)}. This is the lowest balance across the visible forecast, not necessarily your balance immediately after payday. By that date: ${formatCurrency(result.available, { cents: true })} available today + ${formatCurrency(result.income, { cents: true })} forecast income − ${formatCurrency(result.otherOutflows, { cents: true })} other scheduled outflows − ${formatCurrency(result.purchaseByMinimum, { cents: true })} for this purchase − ${formatCurrency(result.everydaySpending, { cents: true })} estimated everyday spending over ${result.days} days = ${formatCurrency(result.minimum.projectedBalance, { cents: true })}. The ${formatCurrency(ctx.bufferThreshold)} buffer is a safety threshold, not another deduction from the projected balance.${result.minimum.conservativeBalance !== result.minimum.projectedBalance ? ` Without uncertain repayments, the balance on that date would be ${formatCurrency(result.minimum.conservativeBalance, { cents: true })}.` : ""}`,
      assumptions: [...assumptionsFor(ctx), "Recalculated from current account records. If your data changed, these figures may differ from the previous reply."],
      actionLabel: "Review the scenario", actionHref: `/cash-flow?amount=${amount}&label=${encodeURIComponent(label)}`,
    };
  }
  if (name === "plan_event_budget") {
    const guests = args.guestCount;
    if (guests !== undefined && (typeof guests !== "number" || !Number.isInteger(guests) || guests < 1 || guests > 10000)) throw new Error("Invalid guest count");
    const date = args.date;
    if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Invalid event date");
    if (args.paymentMode !== undefined && !["covering_all", "splitting"].includes(String(args.paymentMode))) throw new Error("Invalid event payment mode");
    const total = args.totalAmount === undefined ? undefined : positiveAmount(args.totalAmount);
    const ownAmount = args.ownAmount === undefined ? args.paymentMode === "covering_all" ? total : undefined : positiveAmount(args.ownAmount);
    if (total !== undefined && ownAmount !== undefined && ownAmount > total) throw new Error("Event share exceeds total");
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(today); end.setUTCDate(end.getUTCDate() + ctx.forecastDays - ctx.historyDays - 1);
    if (date && (date < today || date > end.toISOString().slice(0, 10))) return { reply: "Please choose a future event date within the visible forecast so I can check its cost against your recorded obligations.", assumptions: [], kind: "guidance" };
    if (date && ownAmount !== undefined) {
      const check = checkAffordability(ctx, { amount: ownAmount, label: "Group event", date });
      return {
        reply: `For the event${guests ? ` with ${guests} people` : ""} on ${formatShortDate(date)}, your proposed share is ${formatCurrency(ownAmount, { cents: true })}. That ${check.affordable ? "keeps the visible forecast above" : "could take the visible forecast below"} your ${formatCurrency(ctx.bufferThreshold)} buffer. Expected minimum: ${formatCurrency(check.minBalance, { cents: true })}; without uncertain repayments: ${formatCurrency(check.conservativeMinBalance, { cents: true })}. This checks the cost you provided; venue availability and prices have not been verified.`,
        assumptions: assumptionsFor(ctx), comparison: [{ label: `Event on ${formatShortDate(date)}`, ...check }],
        actionLabel: "Review cash flow", actionHref: "/cash-flow",
      };
    }
    const available = computeAvailableBalance(ctx.openingBalance, ctx.events);
    const window = safeToSpendWindow(ctx.events, ctx.dailySpend ?? 0);
    const { safeToSpend } = computeSafeToSpend({ availableBalance: available, upcomingBills: window.bills, savingsEarmarks: window.savings, debtsOwed: window.debtsOwed, everydaySpending: window.everydaySpending, preferredBuffer: ctx.bufferThreshold });
    const questions = [
      !date ? "What exact date and city or area are you considering?" : undefined,
      !args.paymentMode && ownAmount === undefined ? "Are you paying for everyone or splitting the cost, and how much do you expect to spend in total?" : undefined,
      args.paymentMode === "splitting" && ownAmount === undefined ? "What will your own share cost? I won't divide by the guest count without knowing the agreed split." : undefined,
      args.paymentMode === "covering_all" && total === undefined && ownAmount === undefined ? "What is the expected total cost you'll cover?" : undefined,
    ].filter(Boolean).join(" ");
    return {
      reply: `I can help you budget for that${guests ? ` group of ${guests}` : " event"}. Your current Safe to Spend is ${formatCurrency(safeToSpend, { cents: true })}, after reserving for obligations, estimated everyday spending, and your ${formatCurrency(ctx.bufferThreshold)} buffer through ${formatShortDate(window.endDate)}. That is today's estimate, not a confirmed budget for the event date. ${questions} Once we know the date and your share, we can check it against the forecast before choosing an activity.`,
      assumptions: [...assumptionsFor(ctx), "Guest counts are not dollar amounts. No venue prices, event cost, or future affordability have been assumed."],
      actionLabel: "Review the forecast", actionHref: "/cash-flow", kind: "guidance",
    };
  }
  if (name === "explain_capabilities") {
    const replies = {
      greeting: "Hi! I’m your CashCompass copilot. I can check a purchase against your upcoming bills, compare buying today versus payday, plan savings, or review spending. What would you like to check?",
      capabilities: "I can compare buying now versus payday, test a late repayment, plan savings, or review spending. Try “Can I afford $200 today?” or choose a suggested prompt.",
      purchase_amount: "How much does the purchase cost? Tell me the amount and I’ll compare it with your upcoming bills and cash-flow buffer.",
      unsupported: "I’m here to help with your CashCompass finances. Try asking about an upcoming purchase, a late repayment, savings, or this month’s spending.",
    };
    if (typeof args.reason !== "string" || !Object.hasOwn(replies, args.reason)) throw new Error("Invalid guidance reason");
    return { reply: replies[args.reason as keyof typeof replies], assumptions: [], kind: "guidance" };
  }
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
    if (!result.found) return { reply: "I couldn't find that outstanding repayment. Add or review it in Settle Up first.", assumptions: [], actionLabel: "Open Settle Up", actionHref: "/settle-up" };
    return {
      reply: `If ${result.counterparty}'s repayment arrives ${delayDays} days late (${formatShortDate(result.newDate!)} instead of ${formatShortDate(result.originalDate!)}), your projected minimum balance is ${formatCurrency(result.minBalance, { cents: true })}. ${result.billsAtRisk} of ${result.totalBills} upcoming bills fall below your buffer if you leave out money owed to you.`,
      assumptions: assumptionsFor(ctx), actionLabel: "Explore the simulator", actionHref: "/cash-flow",
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
      reply: `Reserving ${formatCurrency(amount)} today ${check.affordable ? "keeps your forecast above" : "could put your forecast below"} your ${formatCurrency(check.bufferThreshold)} buffer. Expected minimum: ${formatCurrency(check.minBalance, { cents: true })}; without money owed to you: ${formatCurrency(check.conservativeMinBalance, { cents: true })}. ${check.billsAtRisk}/${check.totalBills} bills at risk.`,
      assumptions: assumptionsFor(ctx), actionLabel: "Explore the simulator", actionHref: `/cash-flow?amount=${amount}`,
    };
  }
  const { now, afterPayday } = compareBuyTimings(ctx, { amount, label });
  const what = label === "this purchase" ? `Spending ${formatCurrency(amount)}` : `Buying ${label} for ${formatCurrency(amount)}`;
  const risk = !now.affordable && now.billsAtRisk > 0 ? ` and puts ${now.billsAtRisk} of ${now.totalBills} upcoming bills at risk` : "";
  return {
    reply: `${what} today ${now.affordable ? "keeps your forecast above" : "could take your forecast below"} your ${formatCurrency(now.bufferThreshold)} buffer${risk}. ${!afterPayday ? "No future payday is recorded for comparison." : afterPayday.affordable ? "Waiting until payday keeps that buffer intact." : "Waiting until payday still needs a closer look at your obligations."}`,
    assumptions: assumptionsFor(ctx),
    comparison: [
      { label: "Buy today", ...now },
      ...(afterPayday ? [{ label: "Buy after payday", ...afterPayday }] : []),
    ],
    actionLabel: "Compare in the simulator", actionHref: `/cash-flow?amount=${amount}&label=${encodeURIComponent(label)}`,
  };
}

/**
 * Pulls the item name out of a purchase question, e.g. "Can I afford a
 * MacBook for $1,200?" or "buy AirPods for 199 dollars" -> "MacBook" /
 * "AirPods". Falls back to "this purchase" rather than guessing.
 */
export function purchaseLabel(message: string, amountMatch: RegExpMatchArray | null): string {
  const named = message.match(/\b(?:buy|afford|get|purchase)\s+(?:(?:a|an|the|some|new|my)\s+)?([A-Za-z][\w'’ -]{0,40}?)\s+(?:for|at|costing|that costs)\s+\$?\s*\d/i);
  if (named) return named[1].trim();
  if (amountMatch?.index !== undefined) {
    const after = message
      .slice(amountMatch.index + amountMatch[0].length)
      .replace(/^\s*(?:dollars?|bucks|usd)\b/i, "")
      .replace(/\b(?:today|now|tomorrow|after|before|this|next|on|right)\b.*$/i, "")
      .replace(/[?.!,]+/g, "")
      .trim();
    if (/^[A-Za-z]/.test(after) && after.split(/\s+/).length <= 5) return after;
  }
  return "this purchase";
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** Recognize planning intent without mistaking a headcount for a purchase price. */
export function eventBudgetRequest(message: string): { guestCount?: number } | null {
  if (!/\b(party|celebration|birthday|graduation|wedding|dinner|trip|vacation|outing)\b/i.test(message) ||
      !/\b(plan|planning|budget|afford|spend|spending|cost|pay|host|hosting|invite|inviting|guests|people|friends|celebrate|celebrating|organize|organizing|organise|treat|throw|give)\b/i.test(message)) return null;
  const count = message.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|guests?|friends?)\b/i)?.[1];
  const guestCount = count ? WORD_NUMBERS[count.toLowerCase()] ?? Number(count) : undefined;
  return guestCount && guestCount <= 10000 ? { guestCount } : {};
}

export function purchaseFollowUp(message: string, history: ChatMessage[]): Record<string, unknown> | null {
  if (!/\b(why|explain|minimum|how (?:come|is)|what does|what is .+ mean)\b/i.test(message)) return null;
  for (const turn of [...history].reverse()) {
    if (turn.role !== "user") continue;
    if (eventBudgetRequest(turn.content)) return null;
    if (!/\b(buy|afford|purchase)\b/i.test(turn.content)) continue;
    const match = turn.content.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
    if (!match) continue;
    return {
      amount: Number(match[1].replace(/,/g, "")), label: purchaseLabel(turn.content, match),
      timing: /after\s+(?:my\s+)?pay\s*day/i.test(message) ? "after_payday" : "today",
    };
  }
  return null;
}

export function respondOffline(message: string, ctx: ForecastContext, history: ChatMessage[] = []): CopilotResult {
  const lower = message.toLowerCase();
  const amountMatch = message.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const run = (name: CopilotTool, args: Record<string, unknown>) => ({ ...respondToTool(name, args, ctx), engine: "offline" as const });
  const followUp = purchaseFollowUp(message, history);
  if (followUp) return run("explain_purchase_forecast", followUp);
  const eventRequest = eventBudgetRequest(message);
  if (eventRequest) return run("plan_event_budget", eventRequest);
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
  if (amount && ["afford", "buy", "get", "rent", "purchase"].some((word) => lower.includes(word))) {
    return run("check_affordability", { amount, label: purchaseLabel(message, amountMatch) });
  }
  if (["afford", "buy", "rent", "purchase", "enough"].some((word) => lower.includes(word))) {
    // A purchase question without an amount: say what it would be checked against.
    const rent = ctx.events
      .filter((e) => e.category === "Housing" && e.record === "planned")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      reply: `Tell me the amount and I'll check it against your bills, for example “Can I afford $1,200 today?”.${rent ? ` Your next rent payment is ${formatCurrency(rent.amount, { cents: true })} to ${rent.counterparty} on ${formatShortDate(rent.date)}.` : ""}`,
      assumptions: [],
      actionLabel: "Open the simulator",
      actionHref: "/cash-flow",
      engine: "offline",
    };
  }
  return { reply: "I can compare buying now versus payday, test a late repayment, plan savings, or review spending. Ask with a specific amount or choose a suggested prompt.", assumptions: [], engine: "offline" };
}
