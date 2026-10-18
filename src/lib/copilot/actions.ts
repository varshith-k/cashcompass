"use server";

import { forecastInputs } from "@/lib/finance/forecast-inputs";
import { requireOwnerId } from "@/lib/auth/session";
import { getBudgets } from "@/lib/finance/budgets";
import { getFinancialEventRepository } from "@/lib/finance/repository";
import { getWishlistGoals } from "@/lib/finance/wishlist-goals";
import { getCopilotResponse } from "./respond";
import type { CopilotResult } from "./types";


export async function askCopilot(message: string): Promise<CopilotResult> {
  const ownerId = await requireOwnerId();
  if (typeof message !== "string" || !message.trim() || message.length > 4000) {
    return { reply: "Enter a question of up to 4,000 characters.", assumptions: [] };
  }
  const events = await getFinancialEventRepository().listEvents();

  return getCopilotResponse(message, {
    events,
    budgets: getBudgets(ownerId),
    wishlistGoals: getWishlistGoals(ownerId),
    ...forecastInputs(events),
  });
}
