"use server";
import { forecastInputs } from "@/lib/finance/forecast-inputs";
import { requireOwnerId } from "@/lib/auth/session";
import { getFinancialSnapshot } from "@/lib/finance/snapshot";
import { getCopilotResponse } from "./respond";
import type { CopilotResult } from "./types";
export async function askCopilot(message: string): Promise<CopilotResult> {
  await requireOwnerId();
  if (typeof message !== "string" || !message.trim() || message.length > 4000) return { reply: "Enter a question of up to 4,000 characters.", assumptions: [] };
  const { events, profile, balanceBasis } = await getFinancialSnapshot();
  if (balanceBasis.source === "unconfigured") return { reply: "Set your available funds in Settings or synchronize a sandbox account before checking affordability.", assumptions: [balanceBasis.description], actionLabel: "Set available funds", actionHref: "/settings", kind: "guidance" };
  return getCopilotResponse(message, { events, budgets: profile.budgets, wishlistGoals: profile.goals, ...forecastInputs(events), openingBalance: balanceBasis.openingBalance, balanceDescription: balanceBasis.description });
}
