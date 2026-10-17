import type {
  FinancialEvent,
  ForecastPoint,
  SafeToSpendInput,
  SafeToSpendResult,
} from "./types";

/**
 * Safe to Spend is deliberately not the same number as the account
 * balance: it subtracts money already committed to upcoming bills and
 * savings earmarks, then holds back the user's preferred buffer.
 */
export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const safeToSpend = Math.max(
    0,
    input.availableBalance -
      input.upcomingBills -
      input.savingsEarmarks -
      input.preferredBuffer,
  );
  return { safeToSpend, breakdown: input };
}

/**
 * Deterministic day-by-day balance projection from a starting balance and
 * a set of dated events. Low-balance risk is flagged against a buffer
 * threshold rather than zero, so the UI can warn before an overdraft.
 */
export function computeForecast(
  startingBalance: number,
  events: FinancialEvent[],
  options: { days: number; startDate?: Date; lowBalanceThreshold: number },
): ForecastPoint[] {
  const start = options.startDate ?? new Date();
  start.setHours(0, 0, 0, 0);

  const byDate = new Map<string, number>();
  for (const event of events) {
    const signedAmount = event.direction === "income" ? event.amount : -event.amount;
    const key = event.date.slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + signedAmount);
  }

  const points: ForecastPoint[] = [];
  let runningBalance = startingBalance;

  for (let i = 0; i < options.days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    runningBalance += byDate.get(key) ?? 0;

    points.push({
      date: key,
      projectedBalance: Math.round(runningBalance * 100) / 100,
      isLowBalanceRisk: runningBalance < options.lowBalanceThreshold,
    });
  }

  return points;
}

export function sumByDirection(
  events: FinancialEvent[],
  direction: FinancialEvent["direction"],
) {
  return events
    .filter((event) => event.direction === direction)
    .reduce((total, event) => total + event.amount, 0);
}

export function selectUpcomingBills(events: FinancialEvent[]) {
  return events
    .filter(
      (event) =>
        event.direction === "expense" &&
        event.record === "planned" &&
        event.category !== "Savings",
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function selectRecentTransactions(events: FinancialEvent[]) {
  return events.filter((event) => event.record === "actual").sort((a, b) => b.date.localeCompare(a.date));
}
