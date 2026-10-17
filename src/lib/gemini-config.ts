import "server-only";

/**
 * Models to try, in order. Google retires and rate-limits models often
 * (2.0/2.5 Flash now return 404; on free-tier keys the newest Flash models
 * can return 429, and busy ones 503), so a request moves on to the next
 * model instead of failing. GEMINI_MODEL, if set, is tried first.
 */
const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.8-flash"];

export function geminiModels(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return preferred ? [preferred, ...DEFAULT_MODELS.filter((m) => m !== preferred)] : DEFAULT_MODELS;
}

/** Override without a code change when Google retires a model. */
export function geminiApiUrl(model: string = geminiModels()[0]!): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

// "This model can't serve us right now": worth trying the next one.
const TRY_NEXT_MODEL = new Set([404, 429, 500, 503]);

/**
 * POSTs a generateContent request, falling back through geminiModels().
 * Returns the parsed response, or null when no model could answer — and
 * logs why (model + HTTP status only; the key travels in a header and is
 * never logged), so a silent local fallback is diagnosable.
 */
export async function postGemini<T>(
  apiKey: string,
  body: unknown,
  { timeoutMs, label }: { timeoutMs: number; label: string },
): Promise<T | null> {
  const failures: string[] = [];

  for (const model of geminiModels()) {
    try {
      const response = await fetch(geminiApiUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(body),
      });
      if (response.ok) return (await response.json()) as T;

      failures.push(`${model} ${response.status}`);
      if (!TRY_NEXT_MODEL.has(response.status)) break;
    } catch (error) {
      // A timeout already cost the full budget; don't multiply it across models.
      failures.push(`${model} ${error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network error"}`);
      break;
    }
  }

  console.warn(`[${label}] Gemini unavailable (${failures.join(", ")}); using local fallback.`);
  return null;
}
