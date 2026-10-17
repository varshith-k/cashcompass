import type { FinancialEvent } from "./types";

/**
 * Builders for what-if events. Every result is tagged with scenarioId so
 * it's obviously reversible — these are never written through the
 * repository, only laid on top of the real baseline for one forecast run.
 */
const SCENARIO_ID = "what-if";

function isoAtDaysFromNow(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function buildPurchaseEvent(input: {
  amount: number;
  label: string;
  date: string;
}): FinancialEvent {
  return {
    id: `${SCENARIO_ID}-purchase`,
    date: input.date,
    amount: input.amount,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "one-time",
    source: "manual",
    category: "Shopping",
    counterparty: input.label || "Planned purchase",
    scenarioId: SCENARIO_ID,
  };
}

/** Shifts an existing event's date later — used for "delay a bill" and "repayment arrives late". */
export function buildShiftedEvent(original: FinancialEvent, delayDays: number): FinancialEvent {
  const shifted = new Date(original.date);
  shifted.setUTCDate(shifted.getUTCDate() + delayDays);
  return {
    ...original,
    id: `${SCENARIO_ID}-shift-${original.id}`,
    date: shifted.toISOString(),
    scenarioId: SCENARIO_ID,
  };
}

export function buildSavingsPlanEvents(input: {
  weeklyAmount: number;
  weeks: number;
  goalLabel: string;
}): FinancialEvent[] {
  return Array.from({ length: input.weeks }, (_, i) => ({
    id: `${SCENARIO_ID}-savings-${i}`,
    date: isoAtDaysFromNow((i + 1) * 7),
    amount: input.weeklyAmount,
    direction: "expense",
    record: "planned",
    certainty: "certain",
    recurrence: "recurring",
    source: "manual",
    category: "Savings",
    counterparty: input.goalLabel || "Savings goal",
    scenarioId: SCENARIO_ID,
  }));
}
