"use server";

import { DEMO_PREFERRED_BUFFER, DEMO_STARTING_BALANCE } from "@/lib/finance/demo-data";
import { requireOwnerId } from "@/lib/auth/session";
import { getBudgets } from "@/lib/finance/budgets";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { getWishlistGoals } from "@/lib/finance/wishlist-goals";
import { getCopilotResponse } from "./respond";
import type { CopilotResult } from "./types";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export async function askCopilot(message: string): Promise<CopilotResult> {
  const ownerId = await requireOwnerId();
  if (typeof message !== "string" || !message.trim() || message.length > 4000) {
    return { reply: "Enter a question of up to 4,000 characters.", assumptions: [] };
  }
  const events = await getFinancialEventRepository().listEvents();
  const nextPayday = events
    .filter((e) => e.category === "Payroll" && e.record === "planned" && e.date.slice(0, 10) >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return getCopilotResponse(message, {
    events,
    budgets: getBudgets(ownerId),
    wishlistGoals: getWishlistGoals(ownerId),
    openingBalance: DEMO_STARTING_BALANCE,
    bufferThreshold: DEMO_PREFERRED_BUFFER,
    forecastDays: FORECAST_TOTAL_DAYS,
    historyDays: FORECAST_HISTORY_DAYS,
    nextPaydayDate: nextPayday?.date ?? null,
  });
}
