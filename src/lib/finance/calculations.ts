import { dateKey, nextMonthlyDate } from "./dates";
import type {
  FinancialEvent,
  ForecastPoint,
  SafeToSpendInput,
  SafeToSpendResult,
} from "./types";

/**
 * Safe to Spend is deliberately not the same number as the account
 * balance: it subtracts what has to come out before the next paycheck
 * (bills, planned savings, debts owed, estimated everyday spending), then
 * holds back the user's preferred buffer. See safeToSpendWindow().
 */
export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const safeToSpend = Math.max(
    0,
    input.availableBalance -
      input.upcomingBills -
      input.savingsEarmarks -
      (input.debtsOwed ?? 0) -
      (input.everydaySpending ?? 0) -
      input.preferredBuffer,
  );
  return { safeToSpend: Math.round(safeToSpend * 100) / 100, breakdown: input };
}

/** The next planned paycheck on or after today, if any. */
export function findNextPayday(events: FinancialEvent[], asOf = dateKey()): FinancialEvent | undefined {
  return events
    .filter((e) => e.category === "Payroll" && e.direction === "income" && e.record === "planned" && dateKey(e.date) >= asOf)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

// Bills, savings and ledger entries are dated events; everything else spent
// is "everyday" spending the forecast has to estimate.
const NON_EVERYDAY_CATEGORIES = new Set(["Housing", "Utilities", "Subscriptions", "Credit card", "Savings", "Repayment"]);
const DAILY_SPEND_LOOKBACK_DAYS = 30;
const DAILY_SPEND_MIN_DAYS = 7;

/**
 * Average everyday spending per day (groceries, dining, transport, other)
 * from actual transactions in the last 30 days. Divides by at least 7 days
 * so a single recent purchase can't produce a huge daily rate.
 */
export function estimateDailySpend(events: FinancialEvent[], asOf = dateKey()): number {
  const from = new Date(`${asOf}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - (DAILY_SPEND_LOOKBACK_DAYS - 1));
  const fromKey = dateKey(from);
  const everyday = events.filter(
    (e) => e.record === "actual" && e.direction === "expense" && !NON_EVERYDAY_CATEGORIES.has(e.category) &&
      dateKey(e.date) >= fromKey && dateKey(e.date) <= asOf,
  );
  if (everyday.length === 0) return 0;
  const earliest = everyday.reduce((min, e) => (dateKey(e.date) < min ? dateKey(e.date) : min), asOf);
  const spanDays = Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${earliest}T00:00:00Z`)) / 86_400_000) + 1;
  const days = Math.min(DAILY_SPEND_LOOKBACK_DAYS, Math.max(DAILY_SPEND_MIN_DAYS, spanDays));
  const total = everyday.reduce((sum, e) => sum + e.amount, 0);
  return Math.round((total / days) * 100) / 100;
}

/**
 * What Safe to Spend has to hold back until the next paycheck (or the next
 * 30 days when no paycheck is scheduled): bills, planned savings and debts
 * owed falling in that window, plus estimated everyday spending.
 */
export function safeToSpendWindow(events: FinancialEvent[], dailySpend: number, asOf = dateKey()) {
  const payday = findNextPayday(events, asOf);
  const fallbackEnd = new Date(`${asOf}T00:00:00.000Z`);
  fallbackEnd.setUTCDate(fallbackEnd.getUTCDate() + 30);
  const endKey = payday ? dateKey(payday.date) : dateKey(fallbackEnd);
  // Overdue items are still owed today, so anything dated before the window end counts.
  const dueBefore = (e: FinancialEvent) => e.record === "planned" && e.direction === "expense" && dateKey(e.date) < endKey;
  const sum = (list: FinancialEvent[]) => Math.round(list.reduce((total, e) => total + e.amount, 0) * 100) / 100;
  const daysUntilEnd = Math.max(0, Math.round((Date.parse(`${endKey}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000));
  return {
    endDate: endKey,
    bills: sum(selectUpcomingBills(events).filter(dueBefore)),
    savings: sum(events.filter((e) => e.category === "Savings" && dueBefore(e))),
    debtsOwed: sum(events.filter((e) => e.category === "Repayment" && dueBefore(e))),
    everydaySpending: Math.round(dailySpend * daysUntilEnd * 100) / 100,
  };
}

/** Posted events affect today's available funds; planned income never does. */
export function computeAvailableBalance(openingBalance: number, events: FinancialEvent[], asOf = dateKey()): number {
  return Math.round((openingBalance + events.filter((event) => event.record === "actual" && dateKey(event.date) <= asOf).reduce((sum, event) => sum + (event.direction === "income" ? event.amount : -event.amount), 0)) * 100) / 100;
}

/**
 * Deterministic day-by-day balance projection from a starting balance and
 * a set of dated events. Low-balance risk is flagged against a buffer
 * threshold rather than zero, so the UI can warn before an overdraft.
 */
export function computeForecast(
  startingBalance: number,
  events: FinancialEvent[],
  options: {
    days: number;
    startDate?: Date;
    lowBalanceThreshold: number;
    /** Estimated everyday spending, subtracted on each future day (see estimateDailySpend). */
    dailySpend?: number;
  },
): ForecastPoint[] {
  const start = new Date(`${dateKey(options.startDate ?? new Date())}T00:00:00.000Z`);
  const startKey = dateKey(start);
  const today = dateKey();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + options.days - 1);
  const endKey = dateKey(end);
  const byDate = new Map<string, number>();
  const uncertainByDate = new Map<string, number>();
  let runningBalance = startingBalance;

  for (const event of events) {
    const signedAmount = event.direction === "income" ? event.amount : -event.amount;
    let key = dateKey(event.date);
    // Include all recorded history, even when it predates the chart window.
    // Overdue obligations remain payable; overdue expected income is not cash.
    if (event.record === "planned" && key < today) {
      if (event.direction === "income") continue;
      key = today;
    }
    if (key < startKey) {
      if (event.record === "actual") runningBalance += signedAmount;
      continue;
    }
    const dates = [key];
    // Monthly bills and paychecks repeat through the visible horizon.
    if (event.record === "planned" && event.recurrence === "recurring" && !["Savings", "Repayment"].includes(event.category)) {
      const originalDate = new Date(event.date);
      const todayDate = new Date(`${today}T00:00:00Z`);
      const firstMonth = Math.max(1, (todayDate.getUTCFullYear() - originalDate.getUTCFullYear()) * 12 + todayDate.getUTCMonth() - originalDate.getUTCMonth());
      for (let month = firstMonth; month <= firstMonth + Math.ceil(options.days / 28) + 1; month++) {
        const next = dateKey(nextMonthlyDate(event.date, month));
        if (next > endKey) break;
        if (next > today) dates.push(next);
      }
    }
    for (const date of dates) {
      byDate.set(date, (byDate.get(date) ?? 0) + signedAmount);
      if (event.certainty === "uncertain" && event.direction === "income") {
        uncertainByDate.set(date, (uncertainByDate.get(date) ?? 0) + event.amount);
      }
    }
  }

  const points: ForecastPoint[] = [];
  let uncertainIncome = 0;
  for (let i = 0; i < options.days; i++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const key = dateKey(date);
    runningBalance += byDate.get(key) ?? 0;
    if (key > today) runningBalance -= options.dailySpend ?? 0;
    uncertainIncome += uncertainByDate.get(key) ?? 0;
    const conservativeBalance = Math.round((runningBalance - uncertainIncome) * 100) / 100;
    points.push({
      date: key,
      projectedBalance: Math.round(runningBalance * 100) / 100,
      conservativeBalance,
      isLowBalanceRisk: conservativeBalance < options.lowBalanceThreshold,
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
        event.category !== "Savings" &&
        event.category !== "Repayment",
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
  return bills.filter((bill) => riskByDate.get(dateKey(bill.date) < dateKey() ? dateKey() : dateKey(bill.date))).length;
}

/**
 * Actual (not planned) expense total per category, for the current
 * calendar month. The same shape a `monthly_category_spend` continuous
 * aggregate read would return once Tiger Data is live.
 */
export function savingsProgressForGoal(events: FinancialEvent[], goalName: string): number {
  return events
    .filter((event) => event.category === "Savings" && event.record === "actual" && event.counterparty === goalName)
    .reduce((sum, event) => sum + event.amount, 0);
}

/** Weekly amount needed to hit a target by its date, given what's saved so far. */
export function recommendedWeeklyContribution(remaining: number, targetDate: string): number {
  if (remaining <= 0) return 0;
  const weeksLeft = Math.max(1, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (7 * 86_400_000)));
  return Math.ceil(remaining / weeksLeft);
}

export function spendByCategoryThisMonth(events: FinancialEvent[]): Map<string, number> {
  const monthKey = dateKey().slice(0, 7);
  const totals = new Map<string, number>();

  for (const event of events) {
    if (event.direction !== "expense" || event.record !== "actual") continue;
    if (!event.date.startsWith(monthKey)) continue;
    totals.set(event.category, (totals.get(event.category) ?? 0) + event.amount);
  }

  return totals;
}
