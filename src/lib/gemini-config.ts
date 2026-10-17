import "server-only";

/** Override without a code change when Google retires a model. */
export function geminiApiUrl(): string {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}
