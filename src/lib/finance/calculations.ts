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

/** Outstanding ledger entries: planned Repayment-category events, split by direction. */
export function selectLedgerEntries(events: FinancialEvent[]) {
  const outstanding = events.filter((event) => event.category === "Repayment" && event.record === "planned");
  return {
    owedToMe: outstanding.filter((event) => event.direction === "income").sort((a, b) => a.date.localeCompare(b.date)),
    iOwe: outstanding.filter((event) => event.direction === "expense").sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export interface ForecastSummary {
  minBalance: number;
  minBalanceDate: string;
  daysAtRisk: number;
}

/** Headline stats for a forecast — what the what-if comparison cards show. */
export function summarizeForecast(points: ForecastPoint[]): ForecastSummary {
  const lowest = points.reduce((min, point) => (point.projectedBalance < min.projectedBalance ? point : min));
  return {
    minBalance: lowest.projectedBalance,
    minBalanceDate: lowest.date,
    daysAtRisk: points.filter((point) => point.isLowBalanceRisk).length,
  };
}

/** Of a set of bills, how many fall on a day the forecast flags as low-balance risk. */
export function countBillsAtRisk(bills: FinancialEvent[], points: ForecastPoint[]) {
  const riskByDate = new Map(points.map((point) => [point.date, point.isLowBalanceRisk]));
  return bills.filter((bill) => riskByDate.get(bill.date.slice(0, 10))).length;
}

/**
 * Actual (not planned) expense total per category, for the current
 * calendar month. The same shape a `monthly_category_spend` continuous
 * aggregate read would return once Tiger Data is live.
 */
export function savingsProgressForGoal(events: FinancialEvent[], goalName: string): number {
  return events
    .filter((event) => event.category === "Savings" && event.counterparty === goalName)
    .reduce((sum, event) => sum + event.amount, 0);
}

/** Weekly amount needed to hit a target by its date, given what's saved so far. */
export function recommendedWeeklyContribution(remaining: number, targetDate: string): number {
  if (remaining <= 0) return 0;
  const weeksLeft = Math.max(1, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (7 * 86_400_000)));
  return Math.ceil(remaining / weeksLeft);
}

export function spendByCategoryThisMonth(events: FinancialEvent[]): Map<string, number> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const totals = new Map<string, number>();

  for (const event of events) {
    if (event.direction !== "expense" || event.record !== "actual") continue;
    if (!event.date.startsWith(monthKey)) continue;
    totals.set(event.category, (totals.get(event.category) ?? 0) + event.amount);
  }

  return totals;
}
