# CashCompass implementation status

Updated October 18, 2026. The original phase delivery was checked October 17; newer teammate features and the MoneyQuest companion are recorded below. [`PROJECT_HANDOFF.md`](../PROJECT_HANDOFF.md) preserves the requirements and now includes the current feature handoff.

## Current feature inventory — October 18, 2026

The MoneyQuest branch includes GitHub `main` through `56a72d1`, including the newer teammate features below. This is source-level delivery evidence, not a fresh assertion that every external service is live.

| Feature | Implemented behavior | Remaining verification / configuration |
| --- | --- | --- |
| Auth0 and app shell | Protected routes, owner-scoped data, account/session controls, responsive shared navigation, themes, reminders, fonts, loading/error feedback. | Earlier Auth0 live checks are historical; production-mode missing-config checks pass for MoneyQuest and Cash Flow. |
| Overview and simulator | Posted balances, Safe to Spend, everyday spend, recurring forecasts, expected/conservative outcomes, buy-now/payday/delay/repayment/savings comparisons. | Financial assumptions and uncertain incoming repayments remain disclosed. |
| Transactions and budgets | Editing/filtering/source provenance, allocations and spending comparisons; Tiger-backed budgets query the monthly category continuous aggregate. | Database aggregate needs the current schema; demo behavior uses local calculations. |
| Bills and credit cards | Manual/assisted capture, upcoming/recurring bills, payment records, statement and minimum-payment fields. | Logged payments do not execute real biller transfers. |
| Receipts | Separate already-paid receipt log, notes, category/month totals, deletion, and receipt-to-split links. | No persistent raw-image archive. |
| Phone scanning | Camera/upload controls and laptop-to-phone QR flow; user confirms extracted data before saving. | One-time scan sessions are process-local and expire after ten minutes; live phone/Gemini check pending in this pass. |
| Bill email reminders | Per-bill scheduling with days-before, local hour/time zone, occurrence tracking, Resend templates, secret-protected cron route, systemd service/timer templates. | Requires email/cron configuration, current schema for durable reminders, and explicit scheduler installation; no live email sent here. |
| Settle Up and bill splitting | Friends/guest emails, partial repayments, optional email and WhatsApp reminders, equal/custom/Gemini-suggested shares, receipt links, exact-cent validation, and linked receivables. | Confirmation required; optional email requires configuration. New split flows have unit coverage; live Gemini/notification checks are separate. |
| Nessie sandbox | Account sync/category mapping, account references, P2P transfers, UUID IDs, empty/new-account compatibility. | User reports prior live sync/P2P. Not independently repeated in this pass. |
| Goals and copilot | Weekly reservations/contributions, forecast effects, validated Gemini financial tools/cards, model/offline fallback, purchase links and image extraction. | Planned AutoSave is not a transfer; service quota/configuration affects live AI features. |
| Tiger Data | Financial-event/reminder/Solana receipt schema, monthly continuous aggregate, and compression of chunks older than 30 days segmented by owner. | Latest schema application, actual database jobs, and durable live behavior require server evidence. Pool currently disables TLS certificate validation while encrypting traffic. |
| Solana | Devnet wallet adapter, fixed demo rate/recipient, successful confirmed transfer verification, signature claims and ledger settlement. | Real payment proof unresolved: latest user attempt never showed Phantom approval. Do not mark live end-to-end payment complete. |
| MoneyQuest | Website launcher/navigation plus separate Luau financial-survival game, six decisions, four stations, HUD/outlook, scoring/results, and replay. | Studio gameplay/publishing, public access, genuine URL, Player launch, and website deployment pending. |
| Deployment | Documented nginx/PM2/systemd flow polls `origin/main`, tests candidate builds, and supports rollback. | This feature-branch push does not trigger that timer. No production access/change performed here. |

The [current handoff](../PROJECT_HANDOFF.md#current-implementation-handoff--october-18-2026) records all feature details and operating boundaries; the [MoneyQuest README](../roblox/moneyquest/README.md) contains exact Studio and publishing instructions.

## MoneyQuest companion — October 18, 2026

Implemented separately on `feature/moneyquest-roblox`; this does not mark the existing integration phases live-verified or deploy a change to main.

- Added `/moneyquest` and a shared sidebar entry after Cash Flow. Mobile More includes it; the bottom bar retains Overview, Cash Flow, and AI Copilot.
- Added a validated `NEXT_PUBLIC_ROBLOX_MONEYQUEST_URL` launcher. Missing/invalid configuration displays “Game publishing in progress.” No experience ID or publication is fabricated.
- Added `roblox/moneyquest`: original four-station 3D neighborhood, six financial choices plus final review, server-controlled integer-cents simulation, deterministic scheduled events, 0–100 scoring, results, and replay. No real finance data or credentials cross into Roblox.
- Rojo 7.7.1 builds `roblox/moneyquest/build/MoneyQuest.rbxlx`. All six Luau source files compile; the pure engine, scorer, request protocol, and tests pass static analysis. Standalone Luau verifies 324 full paths with 4,261 assertions.
- Website verification: after incorporating main through `56a72d1`, lint, typecheck, and production build pass; **175 unit tests pass**, with four live-service tests skipped. A separate credential-free local preview passes eight responsive/theme combinations, axe accessibility, desktop order, mobile More/bottom-bar checks, and navigation to Cash Flow. The earlier production-mode HTTP check confirmed both routes fail closed without Auth0. No live Auth0 sign-in or Roblox launch was performed in this pass.
- **Still requires owner action:** Studio runtime/UI/replication playtesting, publishing/releasing with a Roblox account, testing access from Roblox Player, entering the genuine published URL, and approved website deployment. A built place file is not a Studio playtest or prize-eligibility confirmation.
- Exact import, manual script placement, test paths, publishing, configuration, and limitations: [`roblox/moneyquest/README.md`](../roblox/moneyquest/README.md).

## Original phase status — October 17, 2026

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

## Original verification — October 17, 2026

- **122 passing unit tests**: financial calculations (everyday-spending estimate, Safe to Spend window, recurring paychecks), the demo-story regression guard, scoped actions and bill undo, copilot arguments, wording and fallback, Gemini model fallback, Nessie sync and categories, reminders, Solana verification, and auth/isolation.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass. Fonts are self-hosted (`src/app/fonts`), so the build needs no network access to Google Fonts.
- `npm run audit:ui`: nine routes × 375/768/1024/1440 pixels × light/dark. axe scans mobile and desktop content; development-only Next.js tooling is excluded. HTTP failures and application error boundaries fail the audit.
- `npm run test:demo`: dashboard → copilot → purchase comparison; transaction create/edit/search/delete; bill scan fallback/manual save/payment/renewal; goal scheduling/contribution; WhatsApp link and partial repayment. No browser runtime errors.
- Automated accessibility checks supplement keyboard interactions and visual inspection; they are not a complete screen-reader certification.

## Remaining environment and product limits

- **Earlier recorded live checks:** Auth0 (local and https://cashcompass.club: login callback and logout accepted) and Gemini copilot. The user subsequently reported live Nessie sync/P2P and working deployment automation; those were not independently repeated in this pass. Newer Tiger Data source/schema changes are included, but live migration/aggregate/compression evidence is still needed. Solana's wallet was funded according to the user; a successful payment remains unverified because no approval window appeared on the latest attempt. Live photo extraction, scheduled email delivery, and Roblox publication remain separate checks.
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
