"use server";

import { DEMO_PREFERRED_BUFFER } from "@/lib/finance/demo-data";
import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialSnapshot } from "@/lib/finance/snapshot";
import { getCopilotResponse } from "./respond";
import type { CopilotResult } from "./types";

const FORECAST_HISTORY_DAYS = 5;
const FORECAST_TOTAL_DAYS = 35;

export async function askCopilot(message: string): Promise<CopilotResult> {
  await requireOwnerId();
  if (typeof message !== "string" || !message.trim() || message.length > 4000) {
    return { reply: "Enter a question of up to 4,000 characters.", assumptions: [] };
  }
  const snapshot = await getFinancialSnapshot();
  const { balanceBasis, events } = snapshot;
  if (balanceBasis.source === "unconfigured") return { reply: "Confirm your available funds in Settings or synchronize a Nessie account before checking affordability.", assumptions: [], actionLabel: "Set available funds", actionHref: "/settings" };
  const nextPayday = events
    .filter((e) => e.category === "Payroll" && e.record === "planned" && e.date.slice(0, 10) >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return getCopilotResponse(message, {
    events,
    budgets: snapshot.profile.budgets,
    wishlistGoals: snapshot.profile.goals,
    openingBalance: balanceBasis.openingBalance,
    bufferThreshold: DEMO_PREFERRED_BUFFER,
    forecastDays: FORECAST_TOTAL_DAYS,
    historyDays: FORECAST_HISTORY_DAYS,
    balanceDescription: balanceBasis.description,
    nextPaydayDate: nextPayday?.date ?? null,
  });
}
