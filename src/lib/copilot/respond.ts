import "server-only";
import { respondOffline } from "./respond-offline";
import { respondWithGemini } from "./gemini-client";
import type { ForecastContext } from "./tools";
import type { CopilotResult } from "./types";

export async function getCopilotResponse(message: string, ctx: ForecastContext): Promise<CopilotResult> {
  if (process.env.GEMINI_API_KEY) {
    return respondWithGemini(message, ctx);
  }
  return respondOffline(message, ctx);
}
