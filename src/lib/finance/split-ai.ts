import "server-only";
import { postGemini } from "@/lib/gemini-config";

export interface SplitPerson {
  /** Stable key the model must echo back ("me", a friend id, or "guest-N"). */
  key: string;
  name: string;
}

export interface SuggestedShare {
  key: string;
  amount: number;
  items?: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Turns a natural-language description ("I had pasta, Sreeram had pizza, we
 * shared fries") into per-person amounts. Gemini only proposes; the caller
 * reconciles to the exact total and the user confirms before anything is saved.
 * Returns null when Gemini isn't available or the answer can't be used.
 */
export async function suggestSharesWithGemini(input: {
  total: number;
  merchant: string;
  people: SplitPerson[];
  description: string;
}): Promise<{ shares: SuggestedShare[]; explanation?: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const roster = input.people.map((p) => `- key "${p.key}": ${p.name}${p.key === "me" ? " (the user, referred to as I/me)" : ""}`).join("\n");
  const prompt = `Split a bill of ${input.total.toFixed(2)} from "${input.merchant.slice(0, 80)}" between these people:
${roster}

How the user describes who had what:
"""${input.description.slice(0, 1500)}"""

Rules:
- Give each person the cost of what they had. Items several people shared are split evenly between them.
- Tax, tip, service charge and anything not attributed to someone are shared in proportion to each person's items (or evenly if no items are given).
- Use only the keys listed above. Amounts are in the bill's currency, non-negative, and must add up to exactly ${input.total.toFixed(2)}.
Respond with only this JSON: {"shares": [{"key": string, "amount": number, "items": string}], "explanation": string}`;

  try {
    const data = await postGemini<GeminiResponse>(
      apiKey,
      { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } },
      { timeoutMs: 20000, label: "split" },
    );
    const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { shares?: unknown; explanation?: unknown };
    if (!Array.isArray(parsed.shares)) return null;

    const keys = new Set(input.people.map((p) => p.key));
    const shares: SuggestedShare[] = [];
    for (const raw of parsed.shares as Record<string, unknown>[]) {
      const key = typeof raw?.key === "string" ? raw.key : "";
      const amount = typeof raw?.amount === "number" ? raw.amount : Number.NaN;
      if (!keys.has(key) || !Number.isFinite(amount) || amount < 0) continue;
      shares.push({ key, amount, items: typeof raw.items === "string" ? raw.items.slice(0, 200) : undefined });
    }
    if (shares.length === 0) return null;
    return { shares, explanation: typeof parsed.explanation === "string" ? parsed.explanation.slice(0, 400) : undefined };
  } catch (error) {
    console.warn("[split] Could not read Gemini's split:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}
