import "server-only";
import { respondOffline } from "./respond-offline";
import { respondWithGemini } from "./gemini-client";
import type { ForecastContext } from "./tools";
import type { ChatMessage, CopilotResult } from "./types";

export async function getCopilotResponse(message: string, ctx: ForecastContext, history: ChatMessage[] = []): Promise<CopilotResult> {
  if (process.env.GEMINI_API_KEY) {
    return respondWithGemini(message, ctx, history);
  }
  return respondOffline(message, ctx, history);
}
