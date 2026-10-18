import "server-only";
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";

import { postGemini } from "@/lib/gemini-config";

export interface ExtractedBill {
  counterparty?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  category?: string;
  /** Credit card statements only. */
  minimumPayment?: number;
}

/** "bill": something still to pay (due date). "receipt": an already-paid purchase (purchase date). */
export type ScanKind = "bill" | "receipt";

const PROMPTS: Record<ScanKind, string> = {
  bill: `Extract the payee/biller name, total amount due, due date, and the best-fitting category from this bill or statement photo.
If it is a credit card statement, use category "Credit card", the statement balance as "amount", and also return "minimumPayment" (the minimum payment due).`,
  receipt: `This is a receipt for a purchase that has already been paid (restaurant, shop, cafe, cab, etc.).
Extract the merchant/shop name, the final total paid (including tax and tip), the purchase date, and the best-fitting category.`,
};

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Extracts bill fields from a photo via Gemini's image input. Returns
 * null — never a guess — whenever extraction can't happen: no API key,
 * a request failure, or a response that doesn't parse as the expected
 * JSON shape. The caller always falls back to blank, user-filled form
 * fields rather than silently saving something unconfirmed.
 */
export async function extractBillFromImage(
  base64Data: string,
  mimeType: string,
  kind: ScanKind = "bill",
): Promise<ExtractedBill | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `${PROMPTS[kind]}
Category must be exactly one of: ${EXPENSE_CATEGORIES.join(", ")}.
Respond with only this JSON shape, no other text: {"counterparty": string, "amount": number, "date": "YYYY-MM-DD", "category": string${kind === "bill" ? ', "minimumPayment": number' : ""}}.
If a field truly cannot be read from the image, omit it rather than guessing.`;

    const data = await postGemini<GeminiResponse>(
      apiKey,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      },
      { timeoutMs: 20000, label: "bill-scan" },
    );
    const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
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
    if (
      kind === "bill" &&
      typeof parsed.minimumPayment === "number" &&
      Number.isFinite(parsed.minimumPayment) &&
      parsed.minimumPayment > 0 &&
      (result.amount === undefined || parsed.minimumPayment <= result.amount)
    ) {
      result.minimumPayment = Math.round(parsed.minimumPayment * 100) / 100;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn("[bill-scan] Could not read Gemini's response:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}
