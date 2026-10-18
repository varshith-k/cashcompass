import "server-only";
import { DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE } from "./demo-data";
import { estimateDailySpend, findNextPayday } from "./calculations";
import type { FinancialEvent } from "./types";

export const FORECAST_HISTORY_DAYS = 5;
export const FORECAST_TOTAL_DAYS = 35;

/**
 * The shared inputs every forecast (dashboard, simulator, copilot) uses, so
 * they always agree.
 *
 * Opening balance: the in-memory demo store seeds every user with demo
 * events, which assume DEMO_STARTING_BALANCE. With a real database a new
 * user has no seeded history, so they start from $0 plus their own records
 * instead of inheriting the demo balance.
 */
export function forecastInputs(events: FinancialEvent[]) {
  return {
    openingBalance: process.env.DATABASE_URL ? 0 : DEMO_STARTING_BALANCE,
    bufferThreshold: DEMO_PREFERRED_BUFFER,
    dailySpend: estimateDailySpend(events),
    nextPaydayDate: findNextPayday(events)?.date ?? null,
    forecastDays: FORECAST_TOTAL_DAYS,
    historyDays: FORECAST_HISTORY_DAYS,
  };
}
