# CashCompass implementation status

Checked October 17, 2026. This is the current delivery record; `PROJECT_HANDOFF.md` preserves the original requirements.

## Phase status

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 — Audit | Complete | Existing routes, repositories, auth, integrations, environment names, build commands, history, and remote inspected. |
| 1 — Foundation | Complete for the demo | Responsive shell, semantic colors, keyboard focus, reduced motion, loading skeleton, and recoverable error boundary. |
| 2 — Dashboard and forecast | Complete for the demo | Available funds use posted activity; Safe to Spend explains its actual deductions. Expected and conservative forecasts share deterministic calculations and readable tables. |
| 3 — Transactions, bills, Nessie | Implemented; live sandbox verification pending | Transaction editing added; monthly bills renew when paid. Bill scans require confirmation. Configured sandbox accounts are selectable, with balance references and stable-ID import/update protection. |
| 4 — Copilot and simulator | Complete; Gemini verified live | Validated tools, grounded result cards, visible Gemini/fallback label, reversible scenarios, purchase inputs carried into the simulator. Live answers confirmed with a real key (`npm run test:gemini`); model fallback and failure logging in `gemini-config.ts`. |
| 5 — Budgets, goals, ledger | Complete for the demo | Editable allocations, weekly planned reserves, confirmed goal contributions, partial repayments, real WhatsApp links, and shared forecast events. |
| 6 — Verification | Local verification complete | Unit tests, lint, types, production build, responsive/accessibility audit, and connected browser demo. External services require credentials for live checks. |
| 7 — GitHub delivery | Complete | Delivered implementation, verification, teammate-fix integration, and documentation commits to the existing private `varshith-k/cashcompass` repository on `main`. |

## Work completed in this pass

- Rebalanced the demo account so the flagship question shows real risk: $2,250 available, rent due before payday; a $1,200 purchase today puts bills at risk, after payday is safe (guarded by a regression test).
- Added an everyday-spending estimate to every forecast (dashboard, simulator, copilot) and repeated recurring paychecks like recurring bills.
- Safe to Spend now covers the period to the next paycheck and subtracts debts owed and estimated everyday spending; the tooltip shows each deduction.
- Removed Nessie labels from made-up demo events; the top-bar badge shows Nessie only when it is configured. Imported Nessie spending gets categories from merchant tags/names; pending card purchases count as spent instead of becoming bills.
- A real database starts users at $0 instead of the demo opening balance. Delete actions check the record type. Partial ledger payments link to their entry.
- Fixed offline copilot wording ("Buying dollars…", "Buying this purchase…") and answered amount-less rent questions with the real next rent payment.
- Self-hosted Inter and Manrope (SIL OFL) so builds don't depend on Google Fonts.

- Integrated the latest teammate account-menu and server-only settlement-helper fixes; extended browser coverage to the account and reminder menus.

- Added transaction editing with retained source provenance and recoverable save errors.
- Renewed recurring bills after payment, with month-end clamping and duplicate-payment protection.
- Made financial mutations refresh all dependent pages, rather than leaving cached charts and budgets stale.
- Included recorded history before the chart window in balances. Current available funds exclude planned activity; future comparisons exclude historical lows.
- Kept scheduled savings out of confirmed progress, consumed scheduled reserves when contributing, and removed abandoned schedules when deleting a goal.
- Added weekly savings planning, with target caps and a final partial week when needed.
- Distinguished uncertain incoming repayments with a conservative balance; kept ledger items out of bill lists.
- Added accessible daily chart tables, input validation, loading/error screens, form pending states, usable search and reminder navigation, touch targets, and reduced motion.
- Removed the catch-all wallet bundle; imported only Phantom and Solflare and supplied the wallet-standard `bs58` peer dependency.
- Required confirmed successful on-chain transfers, validated the payable entry, and prevented signature reuse. Database receipt claims survive restarts; keyless demo claims are process-local.
- Added Nessie account selection, reference balances, stable external IDs, pending/completed updates, and persistence of ledger phone numbers.
- Replaced unvalidated Gemini financial prose with deterministic formatting of validated tool results. Plain model text cannot introduce balances or projections. Missing/failing Gemini is disclosed in the conversation.
- Centralized `GEMINI_MODEL`, shared by copilot and photo extraction. The default is `gemini-3.6-flash`, following Google's replacement guidance for retired `gemini-2.0-flash`. [Google model lifecycle documentation](https://ai.google.dev/gemini-api/docs/deprecations).

## Verification

- **122 passing unit tests**: financial calculations (everyday-spending estimate, Safe to Spend window, recurring paychecks), the demo-story regression guard, scoped actions and bill undo, copilot arguments, wording and fallback, Gemini model fallback, Nessie sync and categories, reminders, Solana verification, and auth/isolation.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass. Fonts are self-hosted (`src/app/fonts`), so the build needs no network access to Google Fonts.
- `npm run audit:ui`: nine routes × 375/768/1024/1440 pixels × light/dark. axe scans mobile and desktop content; development-only Next.js tooling is excluded. HTTP failures and application error boundaries fail the audit.
- `npm run test:demo`: dashboard → copilot → purchase comparison; transaction create/edit/search/delete; bill scan fallback/manual save/payment/renewal; goal scheduling/contribution; WhatsApp link and partial repayment. No browser runtime errors.
- Automated accessibility checks supplement keyboard interactions and visual inspection; they are not a complete screen-reader certification.

## Remaining environment and product limits

- **Live-verified:** Auth0 (local and https://cashcompass.club: login callback and logout accepted) and Gemini (copilot answers through Gemini; bill-photo extraction still needs a live check when quota allows). **Not yet live-tested:** Nessie sandbox sync, TimescaleDB migrations, and a real Solana devnet broadcast (needs a funded test wallet).
- Without `DATABASE_URL`, financial events reset on server restart. Budgets, goal definitions, sync status, and demo signature claims remain process-local. Multi-process or production deployment needs durable stores and transactional multi-step mutations.
- Forecast balances start from an opening amount plus recorded activity: the demo opening balance in demo mode (no `DATABASE_URL`), or $0 with a real database. Nessie account balances are references in Settings; importing activity does not reconcile the opening amount to the sandbox balance.
- Projections cover the displayed horizon. Monthly planned bills and paychecks repeat. Everyday spending is estimated from the last 30 days of actual everyday purchases (at least a 7-day average) and subtracted on each future day; interest, fees, and unknown future events are excluded. Repayments may arrive late or never. Safe to Spend holds back bills, planned savings, debts owed and estimated everyday spending due before the next paycheck (or the next 30 days), plus the buffer. All financial dates use UTC calendar days.
- AutoSave is a planned reservation, not an executed bank transfer. Goal progress counts confirmed reserves, and a contribution reduces its future scheduled reserve amount.
- Bill payment records a payment in CashCompass; it does not submit a payment to Nessie or a biller. A manually renewed bill is a separate manual record.
- Solana uses devnet, an explicit fixed demo conversion rate, and a fixed recipient; it has no per-counterparty wallet linking or live price feed. Receipt claims and ledger writes are separate operations; a process crash between them needs reconciliation before retry. This is not a production payment system.
- Bill photos are JPEG/PNG/WebP, at most 5 MB, processed once without raw image storage. Unreadable/unsupported images return manual entry; saving always requires confirmation.
- Browser conversation history lasts for the mounted chat session. Cross-session storage and token streaming are not implemented. Pending feedback describes the request honestly instead of pretending timed stages reflect actual tool execution.

## Dependencies

The full online npm audit after trimming the wallet bundle reports **24 findings: 0 critical, 9 high, 15 moderate** (including transitive parent-package findings). The original handoff recorded 115 after adding the catch-all Solana bundle. The critical `protobufjs` path from unused wallet adapters is removed. `braces` still appears through the retained shadcn/ESLint toolchain; `stream-json` and `uuid` also remain in retained dependencies. The audit's proposed fixes include breaking changes or no available fix. No forced major downgrades were applied. Recheck advisories before deployment.

## Three-minute demo

1. Open Overview: $2,250 available, but Safe to Spend is about $92 because rent ($1,250) and other bills are due before payday. Hover the Safe to Spend info icon for the breakdown.
2. Ask the copilot "Can I afford a $1,200 MacBook today?". Buying today puts rent at risk; after payday stays above the buffer. Point out the "Gemini · verified calculations" label.
3. Open its simulator action. Switch between buying now and after payday; no account records change.
4. Create a goal, plan weekly reserves, and confirm a contribution. Show the forecast and budget updates.
5. Show monthly bill renewal (and Undo), the notification reminders, the ledger, and optional WhatsApp reminders. Demo records are labeled manual; only synced records carry the Nessie label.
6. In Settings, show configuration/synchronization state honestly. A configured sandbox can demonstrate account selection and idempotent re-sync.
