"use server";

import { DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE } from "@/lib/finance/demo-data";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { getCopilotResponse } from "./respond";
import type { CopilotResult } from "./types";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export async function askCopilot(message: string): Promise<CopilotResult> {
  const events = await getFinancialEventRepository().listEvents();
  const nextPayday = events
    .filter((e) => e.category === "Payroll" && e.record === "planned")
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return getCopilotResponse(message, {
    events,
    openingBalance: DEMO_STARTING_BALANCE,
    bufferThreshold: DEMO_PREFERRED_BUFFER,
    forecastDays: FORECAST_TOTAL_DAYS,
    historyDays: FORECAST_HISTORY_DAYS,
    nextPaydayDate: nextPayday?.date ?? new Date().toISOString(),
  });
}
