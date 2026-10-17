# AI Copilot boundary

The chat UI never computes a number — it calls `askCopilot()`, which runs
one deterministic tool from `tools.ts` (the same forecast/scenario math the
dashboard and cash-flow simulator use) and only ever explains that tool's
result. This is what keeps the "never invent a balance or projection"
requirement true by construction rather than by prompting.

## Current state (demo mode)

- `tools.ts` — four tools: `checkAffordability`, `checkRepaymentDelay`,
  `suggestSavingsPlan`, `spendingBreakdown`. Each wraps existing
  `calculations.ts`/`scenarios.ts` functions.
- `respond-offline.ts` — a small keyword classifier that picks one tool
  from the message and builds the reply entirely from its return value.
  This is what runs today, with no API key, and it's fully tested (see the
  prompts in `copilot-chat.tsx`'s suggestion chips).
- `gemini-client.ts` — a real Gemini function-calling implementation
  (two-turn: ask Gemini to pick a tool, run it ourselves, send the result
  back for Gemini to explain in prose). Activates automatically once
  `GEMINI_API_KEY` is set. **Untested against the live API** — written
  against the stable `generateContent` REST contract, but not run. On any
  failure (bad key, network, unexpected response shape) it falls back to
  `respond-offline.ts` rather than erroring, so a broken key degrades to a
  still-correct answer instead of a broken page.
- `respond.ts` — picks Gemini vs. offline based on whether the key is set.

## Extending it

Adding a fifth capability means: write the pure calculation in
`calculations.ts`/`scenarios.ts` if it doesn't exist yet, add a tool in
`tools.ts` that wraps it, add a branch in `respond-offline.ts`'s
classifier, and add a `functionDeclarations` entry + `runTool` case in
`gemini-client.ts`. Keep both the offline and Gemini surfaces for a tool in
sync — the offline one is what's actually demoed until a key is set.
