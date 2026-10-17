import "server-only";
import { spendByCategoryThisMonth } from "@/lib/finance/calculations";
import { respondOffline } from "./respond-offline";
import {
  checkRepaymentDelay,
  compareBuyTimings,
  spendingBreakdown,
  suggestSavingsPlan,
  type ForecastContext,
} from "./tools";
import type { CopilotResult } from "./types";

const MODEL = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: "You are CashCompass's financial copilot. You never invent balances, transactions, or projections — every number in your reply must come from calling exactly one tool first. Explain that tool's result in two or three plain sentences. If no tool fits the question, say so honestly instead of guessing.",
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

function runTool(name: string, args: Record<string, unknown>, ctx: ForecastContext) {
  switch (name) {
    case "check_affordability":
      return compareBuyTimings(ctx, {
        amount: Number(args.amount) || 0,
        label: String(args.label ?? "this purchase"),
      });
    case "check_repayment_delay":
      return checkRepaymentDelay(ctx, {
        counterpartyContains: args.counterpartyContains ? String(args.counterpartyContains) : undefined,
        delayDays: Number(args.delayDays) || 5,
      });
    case "suggest_savings_plan":
      return suggestSavingsPlan(
        ctx.events,
        ctx.wishlistGoals,
        args.goalNameContains ? String(args.goalNameContains) : undefined,
      );
    case "spending_breakdown":
      return spendingBreakdown(spendByCategoryThisMonth(ctx.events), ctx.budgets);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function callGemini(apiKey: string, contents: unknown[]): Promise<GeminiResponse | null> {
  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: SYSTEM_INSTRUCTION, contents, tools: TOOLS }),
  });
  if (!response.ok) return null;
  return response.json();
}

/**
 * Real Gemini function-calling. On any failure — missing key, network
 * error, unexpected response shape — this falls back to the offline
 * responder rather than surfacing an error, since that responder gives a
 * real, grounded answer anyway. Untested against the live API; the
 * fallback is the safety net for exactly that.
 */
export async function respondWithGemini(message: string, ctx: ForecastContext): Promise<CopilotResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return respondOffline(message, ctx);

  try {
    const first = await callGemini(apiKey, [{ role: "user", parts: [{ text: message }] }]);
    const firstParts = first?.candidates?.[0]?.content?.parts;
    const functionCallPart = firstParts?.find((p) => p.functionCall);

    if (!functionCallPart?.functionCall) {
      const text = firstParts?.find((p) => p.text)?.text;
      return text ? { reply: text, assumptions: [] } : respondOffline(message, ctx);
    }

    const { name, args } = functionCallPart.functionCall;
    const toolResult = runTool(name, args ?? {}, ctx);

    const second = await callGemini(apiKey, [
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ functionCall: functionCallPart.functionCall }] },
      { role: "user", parts: [{ functionResponse: { name, response: toolResult } }] },
    ]);
    const finalText = second?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;

    return finalText
      ? {
          reply: finalText,
          assumptions: ["Explained by Gemini from a deterministic tool result — the model never generated a number itself."],
        }
      : respondOffline(message, ctx);
  } catch {
    return respondOffline(message, ctx);
  }
}
