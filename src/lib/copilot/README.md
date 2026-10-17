# Copilot boundary

The UI calls `askCopilot()`, which loads only the signed-in user's financial events, goals, and budgets. All calculations reuse `calculations.ts` and `scenarios.ts`.

- `tools.ts`: affordability/timing comparisons, late repayments, savings schedules, and spending breakdowns.
- `respond-offline.ts`: local intent matching and deterministic formatting of tool results, cards, assumptions, and simulator links.
- `gemini-client.ts`: Gemini selects one allowlisted function. The server validates its arguments and renders the same grounded result. Unvalidated model prose is never shown as financial guidance.
- `respond.ts`: chooses Gemini if configured; failures return the same local tools with a visible fallback label.
- `../gemini-config.ts`: shared model endpoint for chat and bill photos. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`; the default model is `gemini-3.6-flash`.

Tests mock Gemini to verify tool validation, result preservation, unsupported output, and failure handling. Live Gemini calls require credentials and have not been verified in this environment. Chat history is local to the mounted view; token streaming and durable conversations are not implemented.

New tools must update their calculation, deterministic renderer, offline intent matching, Gemini declaration, and argument validation together.
