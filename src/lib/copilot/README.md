# Copilot boundary

The UI calls `askCopilot()`, which loads only the signed-in user's financial events, goals, and budgets. All calculations reuse `calculations.ts` and `scenarios.ts`.

- `tools.ts`: affordability/timing comparisons, late repayments, savings schedules, and spending breakdowns.
- `respond-offline.ts`: local intent matching and deterministic formatting of tool results, cards, assumptions, and simulator links.
- `gemini-client.ts`: Gemini selects one allowlisted function. The server validates its arguments and renders the same grounded result. Unvalidated model prose is never shown as financial guidance.
- Greetings, capability questions, missing purchase amounts, and off-topic requests use the validated `explain_capabilities` function. Function calling uses `ANY` so these messages have an explicit supported path. Guidance is labeled “Gemini · CashCompass guide”; financial results retain “Gemini · verified calculations.” A rejected response or unavailable API uses “Local response · Gemini fallback,” without asserting an API outage from an unsupported answer alone.
- `respond.ts`: chooses Gemini if configured; failures return the same local tools with a visible fallback label.
- `../gemini-config.ts`: shared model endpoint for chat and bill photos. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`; the default model is `gemini-3.6-flash`.

Tests mock Gemini to verify tool validation, result preservation, unsupported output, and failure handling. Live Gemini calls are verified with `npm run test:gemini` (opt-in; needs GEMINI_API_KEY in .env.local, spends quota). `../gemini-config.ts` falls back through current Flash models when one is retired (404), out of quota (429) or overloaded (503), and logs why when it falls back to local calculations.

Recent user/assistant messages are passed with each request (at most 12 turns, 4,000 characters per turn, 16,000 characters total). Only role/text fields are accepted. Gemini uses them to resolve follow-ups; prior assistant answers and client-provided calculation objects are not authoritative account data. Purchase explanations recompute the forecast from the current authenticated snapshot, including the minimum date and its income/outflow/spending breakdown. Event planning can use dates, costs, and payer details supplied in later turns. Messages remain in the mounted view only: refresh/navigation clears them; durable conversations and token streaming are not implemented.

New tools must update their calculation, deterministic renderer, offline intent matching, Gemini declaration, and argument validation together.

October 18, 2026: six opt-in live checks passed with synthetic data: affordability, savings, spending, “hi”, an off-topic message, and bill-image extraction. These local checks do not establish the configuration or rollout of the Vultr deployment.
