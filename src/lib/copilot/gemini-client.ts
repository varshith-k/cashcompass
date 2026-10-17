import "server-only";
import { postGemini } from "@/lib/gemini-config";
import { respondOffline, respondToTool, type CopilotTool } from "./respond-offline";
import type { ForecastContext } from "./tools";
import type { CopilotResult } from "./types";

const SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: "Select exactly one CashCompass function for the user request. Extract its arguments from the request and use the supplied goal and counterparty names. Never invent an amount or name. Do not answer financial questions in free text. If no function fits, say that the request is unsupported.",
    },
  ],
};

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "check_affordability",
        description:
          "Check whether a purchase fits the user's real cash flow today versus waiting until their next payday.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Purchase amount in dollars" },
            label: { type: "string", description: "What is being purchased" },
            savings: { type: "boolean", description: "True for checking a one-time savings allocation" },
          },
          required: ["amount", "label"],
        },
      },
      {
        name: "check_repayment_delay",
        description: "Check the impact of an uncertain repayment on the ledger arriving a number of days late.",
        parameters: {
          type: "object",
          properties: {
            counterpartyContains: { type: "string", description: "Part of the name of who owes the repayment" },
            delayDays: { type: "number", description: "How many days late" },
          },
          required: ["delayDays"],
        },
      },
      {
        name: "suggest_savings_plan",
        description: "Recommend a weekly savings amount to hit a wishlist goal's target date.",
        parameters: {
          type: "object",
          properties: {
            goalNameContains: { type: "string", description: "Part of the goal's name" },
          },
        },
      },
      {
        name: "spending_breakdown",
        description: "Show which budget categories are over their limit this month, and the top spending categories.",
        parameters: { type: "object", properties: {} },
      },
    ],
  },
];

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

function callGemini(apiKey: string, contents: unknown[]): Promise<GeminiResponse | null> {
  return postGemini<GeminiResponse>(
    apiKey,
    { systemInstruction: SYSTEM_INSTRUCTION, contents, tools: TOOLS },
    { timeoutMs: 15000, label: "copilot" },
  );
}

/** Gemini selects a validated tool. Financial prose and cards are rendered from its result. */
export async function respondWithGemini(message: string, ctx: ForecastContext): Promise<CopilotResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return respondOffline(message, ctx);
  const fallback = () => ({ ...respondOffline(message, ctx), engine: "fallback" as const });
  try {
    const response = await callGemini(apiKey, [{ role: "user", parts: [{ text: `Available goals: ${ctx.wishlistGoals.map((g) => g.name).join(", ")}. Outstanding repayments: ${ctx.events.filter((e) => e.category === "Repayment" && e.record === "planned").map((e) => e.counterparty).join(", ")}. User request: ${message}` }] }]);
    const call = response?.candidates?.[0]?.content?.parts?.find((p) => p.functionCall)?.functionCall;
    const allowed: CopilotTool[] = ["check_affordability", "check_repayment_delay", "suggest_savings_plan", "spending_breakdown"];
    if (!call || !allowed.includes(call.name as CopilotTool)) {
      // A null response was already logged by postGemini.
      if (response) console.warn("[copilot] Gemini did not choose a supported tool; using local fallback.");
      return fallback();
    }
    return { ...respondToTool(call.name as CopilotTool, call.args ?? {}, ctx), engine: "gemini" };
  } catch (error) {
    console.warn("[copilot] Gemini response handling failed:", error instanceof Error ? error.message : "unknown error");
    return fallback();
  }
}
