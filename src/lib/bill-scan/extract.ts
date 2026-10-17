import "server-only";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";

import { geminiApiUrl } from "@/lib/gemini-config";

export interface ExtractedBill {
  counterparty?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  category?: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Extracts bill fields from a photo via Gemini's image input. Returns
 * null — never a guess — whenever extraction can't happen: no API key,
 * a request failure, or a response that doesn't parse as the expected
 * JSON shape. The caller always falls back to blank, user-filled form
 * fields rather than silently saving something unconfirmed.
 *
 * Untested against the live API — written against the stable
 * `generateContent` + `responseMimeType: "application/json"` contract,
 * not run with a real key.
 */
export async function extractBillFromImage(
  base64Data: string,
  mimeType: string,
): Promise<ExtractedBill | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `Extract the payee/biller name, total amount due, due date, and the best-fitting category from this bill or receipt photo.
Category must be exactly one of: ${EXPENSE_CATEGORIES.join(", ")}.
Respond with only this JSON shape, no other text: {"counterparty": string, "amount": number, "date": "YYYY-MM-DD", "category": string}.
If a field truly cannot be read from the image, omit it rather than guessing.`;

    const response = await fetch(geminiApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) return null;

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<ExtractedBill>;
    const result: ExtractedBill = {};

    if (typeof parsed.counterparty === "string" && parsed.counterparty.trim()) {
      result.counterparty = parsed.counterparty.trim();
    }
    if (typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0) {
      result.amount = Math.round(parsed.amount * 100) / 100;
    }
    if (typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) && !Number.isNaN(new Date(parsed.date).getTime()) && new Date(parsed.date).toISOString().slice(0, 10) === parsed.date) {
      result.date = parsed.date;
    }
    if (typeof parsed.category === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(parsed.category)) {
      result.category = parsed.category;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
