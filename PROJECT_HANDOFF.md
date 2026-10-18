# CashCompass — Project Handoff

> **Your money. Your direction.**

Implementation has progressed beyond this original handoff. See [current phase status and verification](docs/PROJECT_STATUS.md) for the delivery record, including the October 18, 2026 feature inventory below.

This document is the source of truth for handing CashCompass to another model or developer before implementation begins. It records the product direction, requirements, design language, technical expectations, demo strategy, and phased delivery plan.

## Current implementation handoff — October 18, 2026

The numbered sections below preserve the original product requirements. **Do not restart implementation from the historical initial-repository section.** The app already exists. The current MoneyQuest delivery branch is `feature/moneyquest-roblox`; it incorporates GitHub `main` through `56a72d1` and the MoneyQuest implementation from `3279ac9`. Other remote feature branches are not automatically merged by this handoff.

### Delivered feature inventory

Gemini follow-up (October 18): a validated guidance tool now handles greetings, capability questions, missing purchase amounts, and off-topic requests; successful guidance is no longer labeled as an API outage. Financial tools remain deterministic. Six local live Gemini checks passed, including the screenshot's two conversational messages and synthetic bill-photo extraction; 192 unit tests and lint passed. Deployment is pending. Build validation encountered a Turbopack worker-port permission failure, then an existing `/api/auth/me` route context type error under Webpack; neither is claimed as a successful production build for this follow-up. See [copilot boundary](src/lib/copilot/README.md).

| Area | Implemented behavior | Verification / operational boundary |
| --- | --- | --- |
| Application shell | Shared desktop/mobile navigation, light/dark themes, account menu, reminder navigation, responsive charts and accessible tables, loading/error feedback, self-hosted fonts. | MoneyQuest uses the same navigation; bottom bar remains Overview, Cash Flow, AI Copilot, and More. |
| Authentication | Auth0 login/callback/logout, encrypted sessions, owner-scoped financial access, signed-out route protection, local demo fallback. | Demo fallback is development-only. Prior live verification is recorded in status; this delivery does not perform a new live sign-in. |
| Overview and Cash Flow | Posted balances, Safe to Spend deductions, recurring paychecks/bills, everyday-spend estimate, expected/conservative projections, minimum balances and bills at risk. | Dated deterministic calculations; upcoming repayments are explained in plain language and may arrive late. |
| What-If Simulator | Compare purchases today/after payday, delayed bills, late repayments, and savings plans; copilot can prefill purchase inputs. | Scenarios are reversible and do not write financial records. MoneyQuest leaves this simulator intact. |
| Transactions | Create, edit, search/filter, and delete records; preserve manual/Nessie provenance. | Owner-scoped repository; no real bank connection implied. |
| Bills and credit cards | Upcoming bills, recurring renewal, manual payment recording, image-assisted capture, statement amounts and minimum-payment details. | A logged bill payment does not send money to a biller. Extraction requires user confirmation. |
| Receipts | Separate already-paid receipt log, merchant/date/category/notes, monthly/category totals, deletion, and links to split an unsplit receipt. | Receipt spend enters the financial-event model; receipt images are not retained as an image archive. |
| Phone/photo capture | Upload or capture an image; laptop QR handoff to a phone; development QR links use the laptop's network address. | One-time token, one upload, ten-minute process-local expiry. User confirms extracted fields on the laptop before saving. |
| Scheduled bill reminders | Per-bill days-before, hour, and time-zone selection; owner login email; Resend templates; occurrence tracking; cron endpoint and hourly systemd unit templates. | Requires `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, and an installed scheduler. Units in Git do not install themselves. Live delivery is not confirmed by source inspection. |
| Settle Up and friends | Money owed/to repay, named friends or one-off contacts, optional contact email, partial repayments, WhatsApp links, and optional email notifications. | Shared balances are financial records, not proof of an external transfer. Email needs configured sender access. |
| Split a bill | Equal/custom splits or Gemini suggestions from a description; integer-cent reconciliation; receipt linkage; friend/guest shares become Settle Up receivables; optional notifications. | User reviews and confirms shares. Suggestions do not save or transfer funds. No notification was sent during this handoff update. |
| Capital One Nessie | Account selection/reference balances, stable-ID sync, merchant categorization, friend/account mapping, and sandbox P2P transfers. UUID account IDs and empty/new-account handling are supported. | Sandbox data only. User previously reported live sync/P2P; this pass does not independently repeat those operations. |
| Budgets | Editable allocations and spending comparisons; Tiger-backed category totals read `monthly_category_spend`. | Continuous aggregate must exist when using a configured database. Demo mode uses local calculations. |
| Wishlist and savings | Goals, confirmed contributions, weekly reservations, partial final contributions, forecast impact, and planned AutoSave. | Reservations are not bank transfers. Some planning state is still process-local on this branch. |
| Gemini copilot | Validated financial tools, grounded answer cards, simulator links, model fallback, disclosed offline fallback, and image extraction. | Live Gemini, photo extraction, and split suggestions require configuration/quota and separate live evidence. |
| Tiger Data / TimescaleDB | Owner-scoped financial-event persistence; schema for receipt/card/split fields, reminder settings, and Solana claims; monthly continuous aggregate; owner-segmented compression policy after 30 days. | Source/schema implemented. Applying migrations, confirming aggregate/compression jobs, and live persistence remain deployment checks. Current pool encrypts traffic but disables certificate validation; record this deployment trust limitation. |
| Solana | Phantom/Solflare devnet connection, fixed demo USD/SOL rate and recipient, on-chain transfer verification, signature reuse protection, and ledger settlement. | Actual wallet payment is still unverified: the latest user attempt stayed at Sending without a Phantom approval window. Do not call this prize proof complete. |
| Vultr deployment | Documented nginx → PM2 setup and systemd polling of `origin/main`; candidate build/start checks and rollback. | Feature-branch pushes do not deploy through that documented timer. No SSH access, server restart, timer change, or production deployment occurs in this handoff update. |
| MoneyQuest website | `/moneyquest` after Cash Flow, Gamepad2 navigation, mobile More access, original SVG concept, scenario overview, game highlights, simulator CTA, and Open MoneyQuest on Roblox link. | Defaults to the owner's supplied place `73262786586748`. Optional validated URL override; the link states Roblox sign-in/age/playtester restrictions may apply. No iframe or real-data bridge. |
| MoneyQuest Roblox game | Rojo-compatible Luau project; original bank/store/apartment/advisor neighborhood and NPC guides; HUD, objective highlight, decision dialogs, financial outlook, results, and replay. | Place builds; standalone Luau checks pass. Studio/Player runtime and audience access still require owner testing. |

### MoneyQuest rules and scenarios

The server owns per-player integer-cent balances, dates, bills, deposits, and scores. Clients submit only choice/round/revision identifiers; requests check current phase, station visit, distance, request rate, and duplicate/stale revisions. Respawns preserve the round; completed rounds can restart. There is no DataStore economy, multiplayer game mechanic, real account access, Robux purchase, or external banking bridge.

Opening balance **$2,500**; rent **$1,200**; groceries **$300**; utilities **$150**; savings target **$400**; paycheck **$1,500** on day 15; preferred cash cushion **$300**. Opening safe-to-spend is **$300**.

1. **Day 1, Store:** buy a $1,200 laptop today, wait for a day-16 safety check, or reserve $150 in a separate laptop fund.
2. **Day 5, Apartment:** pay rent now or use a fictional extension to day 15 with a $50 fee.
3. **Day 8, Store:** choose the $300 essentials or $500 premium grocery basket.
4. **Day 11, Bank:** respond to a promised $200 roommate repayment; optionally buy $250 shoes before it arrives. Actual receipt is day 24.
5. **Day 12, Advisor:** handle a $450 bike repair from checking/available savings or a $500 day-22 plan.
6. **Day 16, Bank:** save $400, save $200, or save up to $400 after protecting known bills and the buffer.
7. **Day 30, Advisor:** review checking, savings, laptop fund, lowest balance, paid/on-time bills, five scoring components, and three financial lessons; replay.

The score allocates **35** points to on-time bills, **20** to avoiding negative checking, **15** to the cash buffer, **20** to savings progress, and **10** to purchases fitting safe-to-spend. Waiting can buy the laptop and earn **100/100** with **$500 checking**, **$400 savings**, and a **$300 minimum**. Buying today can end at the same $500 while hitting **−$650** before payday. These are deterministic test expectations, not a recorded Studio playthrough.

### Build, test, publish, and next-owner actions

- Full source map, exact Rojo/manual import, reference paths, Studio checks, publishing steps, URL configuration, and limitations: [MoneyQuest README](roblox/moneyquest/README.md).
- Generated local place: `roblox/moneyquest/build/MoneyQuest.rbxlx`. Build output is Git-ignored; teammates must run the documented Rojo build or manual import after pulling. Source and project configuration are committed.
- Roblox icon: upload `roblox/moneyquest/assets/moneyquest-icon.png` (512×512) in Creator Hub → Configurations → Places → starred start place → Icon → Image → Change → Save Changes. Editable SVG source is included. This reuses CashCompass branding; the website logo does not automatically populate Roblox metadata. Upload/moderation and public-release eligibility are separate owner actions.
- Recorded MoneyQuest verification: Rojo 7.7.1 place build, all six Luau scripts compiled, pure modules/tests analyzed, **324 paths / 4,261 assertions**. Website lint/types/build and eight responsive/theme combinations passed; see status for the latest combined-branch unit count.
- Owner supplied the saved experience URL: `https://www.roblox.com/games/73262786586748/CashCompass-MoneyQuest` (place `73262786586748`, universe `10771656737`) and requested that it replace the publishing placeholder. The launcher now defaults to this page without server environment edits and uses the neutral “Open MoneyQuest on Roblox” label, with an access-restriction explanation. Optional `NEXT_PUBLIC_ROBLOX_MONEYQUEST_URL` overrides are still validated. Owner's signed-in screenshot shows the game page/Play control; public join access and Studio runtime remain unverified. Anonymous `GuestProhibited` is not enough to infer public availability.
- Wide thumbnail: `roblox/moneyquest/assets/moneyquest-thumbnail.jpg`, 1920×1080, approximately 540 KB. Built-in imagegen promotional art; original PNG and exact prompt are included. Upload via Creator Hub → Configurations → Places → start place → Thumbnails → Experience Detail Page (and optionally Home Page). This does not change account release eligibility.
- Complete an actual Solana devnet payment and retain its signature/Explorer proof; investigate the missing approval before retrying an uncertain send.
- Verify current database schema/Timescale jobs and the reminder scheduler from the real deployment; code presence is not live verification. Keep DB values, provider keys, session secrets, and SSH credentials out of Git and chat.
- Initial delivery pushed the feature branch. On October 18 the user authorized merging MoneyQuest into `main`, which can trigger the documented Vultr deploy timer. The merge candidate includes newer main changes through `6ec59a5`; verify production rollout separately. Roblox release/URL configuration remains pending. Existing release/other feature branches are preserved.

## 1. Product overview

**CashCompass** is an AI-powered personal finance companion that helps people understand:

- Where their money went
- Where their money stands today
- Where their money is headed next

It combines a working financial dashboard with expense tracking, bills, budgets, shared debts, savings goals, predictive cash-flow intelligence, Gemini, and Capital One Nessie simulated banking data.

The defining product question is:

> **“You may have enough money today. But can you afford what happens afterward?”**

CashCompass answers this using dated financial events, future commitments, projected balances, and deterministic scenario analysis.

CashCompass must feel like a credible consumer fintech product, not a generic hackathon dashboard, CRUD admin panel, or superficial AI mockup.

## 2. Hackathon objective and demo priority

The target is a polished, judge-friendly SwampHacks demonstration, especially for:

- Outstanding User Experience
- Interface Design
- Overall Polish

The strongest three-minute demonstration should be:

1. Open the dashboard and understand financial health immediately.
2. Inspect the future cash-flow timeline.
3. Ask Gemini whether a major purchase is affordable.
4. See the projected timeline and risk update.
5. Compare buying now with buying after payday.
6. Create or adjust a savings goal.
7. Show that bills, budgets, transactions, and forecasts remain connected.

### Highest-priority working features

Build these first and polish them deeply:

1. Financial dashboard
2. Expense and transaction tracking
3. Bill tracking
4. Predictive cash-flow timeline
5. What-if timeline simulator
6. Gemini financial copilot
7. Capital One Nessie demo-data integration

Savings goals and debt tracking are important, but can initially reuse the same underlying financial-event and forecast engine.

## 3. Product modules

The complete product should include:

- Financial overview and account balances
- Expense and income tracking
- Khatabook-style money owed/lent ledger
- Recurring bill tracking and reminders
- Smart budgets and spending recommendations
- Predictive cash-flow forecasting
- Proactive overspending alerts
- Wishlist savings and installment-style goal planning
- AI-powered what-if scenarios
- Gemini financial copilot
- Capital One Nessie simulated banking data

## 4. Core financial concepts

### Safe to Spend

Safe to Spend is a key differentiator and must not be presented as the same thing as current account balance.

It should be calculated from actual available funds while accounting for relevant upcoming bills, planned expenses, savings earmarks, and the user's preferred buffer. The UI must explain the calculation and assumptions in a tooltip or accessible disclosure.

Do not imply that a user can spend their entire available balance safely.

### Financial events

Use a shared financial-event model so that transactions, income, bills, repayments, savings contributions, and scenario events can feed the same calculations.

Each event should distinguish, where applicable:

- Actual versus planned
- Certain versus uncertain
- Income versus expense
- Recurring versus one-time
- Manual versus Nessie-sourced
- Baseline record versus reversible what-if event
- Date and amount
- Category and merchant/counterparty

### Forecast confidence

Forecasts must clearly communicate assumptions and uncertainty. Do not present projections as guaranteed facts.

Expected repayments, planned savings, and similar uncertain events should be visually distinguishable from confirmed account activity and should not silently inflate confidence.

### What-if simulations

Scenarios must be reversible and must not modify real account records. Users should be able to compare:

- Baseline forecast
- Buy now
- Buy after payday
- Delay an expense
- Receive a repayment late
- Save toward a wishlist item

Each comparison should show:

- Minimum projected balance
- Bills covered or at risk
- Financial buffer
- Suggested action
- Relevant assumptions

## 5. Visual identity

CashCompass should be inspired by the clarity and trust of premium banking products while retaining an independent brand. Do not copy Capital One's logo, wordmark, proprietary layouts, or graphics. Do not imply Capital One endorsement or ownership.

### Light-theme tokens

| Token | Value | Purpose |
|---|---|---|
| Brand navy | `#004977` | Navigation, hero surfaces, trust |
| Interactive blue | `#0276B1` | Primary actions and links |
| Interactive blue hover | `#015E8E` | Hover/pressed state |
| Critical red | `#D03027` | Genuine risk, errors, urgency |
| Primary text | `#102A43` | Main readable text |
| Secondary text | `#526477` | Supporting text |
| Canvas | `#F5F8FC` | Page background |
| Surface | `#FFFFFF` | Cards and elevated content |
| Subtle blue surface | `#EBF4FA` | Informational emphasis |
| Borders | `#DFE7EF` | Dividers and card edges |
| Positive teal | `#0F766E` | Healthy savings and outcomes |
| Caution | `#B45309` | Warnings requiring attention |

### Dark-theme tokens

| Token | Value |
|---|---|
| Application background | `#0B1625` |
| Sidebar | `#101F32` |
| Card background | `#14273B` |
| Elevated surfaces | `#1A3249` |
| Primary text | `#F4F8FC` |
| Secondary text | `#ADC0D0` |
| Borders | `#294156` |
| Brighter interaction blue | `#53B5ED` |

Use a 60/30/10 balance:

- 60% neutral foundations
- 30% navy/blue structure
- 10% purposeful accents and status indicators

Red must not be used indiscriminately. Use positive teal for healthy outcomes. All semantic colors must meet WCAG AA contrast requirements.

### Typography and layout

- Use **Manrope** for headlines, totals, and section titles.
- Use **Inter** for body text, labels, inputs, and transaction details.
- Use tabular numerals for balances, dates, projections, and amounts.
- Use an 8px spacing system.
- Use consistent 12–16px card radii.
- Use soft, realistic shadows and thin borders.
- Keep generous whitespace; do not make the interface cramped.
- Use Lucide icons with consistent stroke weight.
- Use a minimal compass-inspired symbol or directional motif for CashCompass branding.
- Use restrained navy/blue gradient treatments only for major financial insights.
- Avoid excessive gradients, glassmorphism, decorative charts, and generic AI sparkle clutter.

## 6. Application shell

### Desktop

Use a premium shell with:

- Left sidebar
- Top bar
- Maximum-width main content area
- Responsive 12-column grid
- Consistent content gutters

Sidebar navigation:

- CashCompass logo
- Overview
- Transactions
- Bills & Payments
- Budgets
- Cash Flow
- Money Owed / Lent
- Wishlist & Goals
- AI Copilot
- Settings

Top bar:

- Current section and contextual breadcrumb
- Search or command entry
- Notifications
- Demo account indicator
- Theme switch
- User avatar

### Tablet and mobile

- Tablet: collapsible navigation and reorganized grids.
- Mobile: compact header and practical bottom navigation.
- Minimum 44px touch targets.
- No horizontal page scrolling.
- Financial data must remain readable at 375px, 768px, 1024px, and 1440px widths.

## 7. Flagship dashboard

The dashboard must communicate product value within the first 10 seconds.

### Welcome context

Display:

> “Good afternoon. Here's where your money stands.”

Add a concise subheading that communicates confidence and upcoming priorities.

### Hero financial overview

Use a high-quality navy/blue hero card containing:

- Total available balance
- Safe-to-Spend amount
- Amount reserved for upcoming bills
- Next payday or expected income
- Financial outlook status

### Key indicators

Show four compact metric cards:

- Monthly income
- Monthly expenses
- Upcoming bills
- Savings progress

Include comparisons, directional indicators, and contextual labels.

### Cash-flow forecast

This is the visual centerpiece. Use a responsive interactive chart showing:

- Current balance
- Projected balance
- Upcoming income
- Bills and planned expenditures
- Low-balance risk periods
- Selected what-if scenarios
- Clearly differentiated assumptions

Use clean axes, responsive tooltips, stable dimensions, accessible chart alternatives, and visible selected states. Do not use misleading axes or invent forecast certainty.

### Insights

Show contextual recommendations such as:

> “Your rent is due in 4 days. Spending $450 today may reduce your balance below your preferred buffer.”

Provide an obvious action such as **Explore safer options**.

### Supporting content

Use progressive disclosure for:

- Recent transactions
- Upcoming bills
- Wishlist savings progress
- Active budget categories

## 8. Transactions and expenses

Provide:

- Transaction history
- Date, merchant, category, amount, and type
- Income/expense classification
- Category chips
- Search and filters
- Quick-add expense action
- Monthly spending breakdown
- Edit and delete interactions

The quick-add workflow should be fast, using a side drawer or compact modal.

Support both:

- Manually recorded cash and card transactions
- Capital One Nessie-provided simulated records

Avoid duplicate records during synchronization. Clearly distinguish source types.

## 9. Bills and recurring payments

Provide:

- Upcoming bills
- Paid/unpaid status
- Due-date timeline
- Recurring bill configuration
- Bill categories
- Payment reminders
- Monthly obligation totals
- Photo-based bill capture: upload a photo of a bill/receipt, extract payee, amount, and due date automatically, and pre-fill the add-bill form for the user to confirm before saving. Never auto-saves unconfirmed data. Uses Gemini's image input (same seam as the AI copilot); when no Gemini key is configured, fails honestly to a manual-entry prompt rather than guessing fields. No raw image storage — the photo is used once to extract fields, then discarded.
- WhatsApp payment reminders: for ledger entries where someone owes the user money, an optional phone number lets the user send a one-tap reminder via WhatsApp's click-to-chat link (`wa.me`), grounded in the entry's real amount and due date. No WhatsApp Business API, Meta approval, or credentials required — this is intentionally the zero-credential version of that idea.

Urgency must be meaningful. A bill due tomorrow should be distinguishable from one due next month without making every bill alarming.

## 10. Budgets

Provide:

- Monthly budget overview
- Category allocations
- Actual spending versus limits
- Remaining budgets
- Utilization indicators
- AI-supported recommendations
- Constructive overspending warnings

Offer actions to adjust a budget or explore a scenario. Avoid judgmental copy.

## 11. Money owed and lent

Build a practical, lightweight personal ledger supporting:

- Money someone owes the user
- Money the user owes someone else
- Counterparties and amounts
- Expected repayment dates
- Partial repayments
- Settlement status

Integrate relevant entries into forecasting. Clearly distinguish expected repayments from guaranteed cash.

Do not build a complex group-settlement platform unless existing functionality requires it.

## 12. Wishlist and AutoSave

Users should be able to:

- Add a desired purchase
- Set price and target date
- Track savings progress
- Plan recurring savings allocations
- Compare purchase dates
- See how saving affects bills and spending
- Receive a recommended savings schedule

Use refined goal cards, progress indicators, and milestone information.

Only show calculated dates and amounts based on real available data and stated assumptions.

AutoSave is planned or earmarked savings unless actual transfer functionality exists. Never imply money moved between accounts when it did not.

## 13. Gemini financial copilot

Gemini must feel integrated into CashCompass, not like an unrelated chatbot.

Provide:

- Contextual chat interface
- Suggested prompt cards
- Conversation history
- Tool-execution feedback
- Loading and streaming states
- Structured result cards
- Inline comparison charts
- Actions to apply scenarios

Suggested prompts:

- “Can I afford a $1,200 MacBook today?”
- “What happens if my roommate pays me five days late?”
- “How much should I save every week for my Miami trip?”
- “Will I have enough money for rent after this purchase?”
- “Show me where I overspent this month.”
- “Can I save $200 without risking my upcoming bills?”

The assistant must convert natural language into validated financial events, invoke deterministic simulation tools, and explain calculations.

Gemini must never invent balances, transactions, interest rates, account data, or projections. Its output should be grounded in application data and calculation results.

### Interaction progression

Show a compact, honest progression:

1. Analyzing your request
2. Checking upcoming obligations
3. Simulating scenarios
4. Preparing recommendation

Final responses should contain:

- Concise recommendation
- Financial impact
- Important assumptions
- Optional chart
- Actionable next step

## 14. Capital One Nessie integration

Nessie is central to the hackathon demonstration and represents simulated banking data only.

Provide an integration experience with:

- Demo account selection
- Account balances
- Transactions
- Merchants
- Payments/transfers where supported
- Recent synchronization status
- Clear distinction between Nessie records and manually created entries

Use the phrase **“Capital One Nessie demo data”** where useful.

Make clear that records are simulated banking records, not real connected consumer accounts.

Never request real bank credentials for Nessie.

Never suggest CashCompass is officially produced, owned, or endorsed by Capital One.

## 15. States and feedback

Never leave an unfinished-looking blank area. Implement:

- Dashboard skeletons
- Stable-size chart loading placeholders
- Empty transaction illustration or iconography
- Helpful first-time budget setup
- Empty wishlist guidance
- Gemini processing indicators
- Actionable API error messages
- Connection and synchronization status
- Toast or inline confirmations after successful operations

Example copy:

- “No expenses yet. Add your first transaction to start understanding your spending.”
- “Your forecast is ready. Explore what changes when you move a purchase.”
- “Unable to load your banking demo data. Retry the connection.”

Do not disguise failed requests as successful operations. Surface errors explicitly.

## 16. Motion and interaction

Every clickable control needs:

- Hover feedback
- Active/pressed state
- Visible keyboard focus
- Disabled state
- Loading feedback when appropriate

Use restrained 150–300ms transitions for:

- Card elevation
- Chart updates
- Progress changes
- Number changes
- Drawer and modal entrances
- Sidebar selection
- Accessible tooltip transitions

Respect `prefers-reduced-motion`. Do not let animation delay important financial information.

## 17. Accessibility and responsive quality

Target WCAG AA:

- Keyboard navigation throughout
- Correct button and form semantics
- Descriptive labels
- Readable contrast
- Visible focus rings
- Accessible error feedback
- Non-color indicators for financial risk
- Readable chart alternatives
- Screen-reader labels for important amounts
- No horizontal overflow or clipped labels
- No broken cards or layout shifts

Test at:

- 375px
- 768px
- 1024px
- 1440px

## 18. Technical direction

First inspect the repository before implementation. Examine:

- Existing application stack
- Components
- Routes
- Styles
- APIs
- Application state
- Existing financial calculation logic
- Existing Nessie and Gemini integration

Prefer the existing stack. If creating new frontend infrastructure, use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts
- Framer Motion or Motion where appropriate

Separate:

- Data access
- Domain calculations
- Application state
- UI components
- Charts and visualizations

Do not duplicate financial calculation logic inside React components.

Preserve working routes, backend functionality, and API contracts. Do not redesign working backend systems solely for visual reasons. Do not replace working features with hardcoded mockups.

Where backend support does not exist, expose clearly labeled demo functionality or a truthful unavailable state.

## 19. Phased implementation plan

### Phase 0 — Repository and architecture audit

- Inspect all existing files, routes, components, styles, APIs, state, and environment configuration.
- Identify current working functionality and contracts.
- Record gaps and risky assumptions.
- Confirm available package manager and existing test/build commands.

### Phase 1 — Foundation and repository setup

- Initialize the Git repository if needed.
- Establish project documentation and contribution conventions.
- Set up or preserve the existing framework.
- Add shared design tokens, fonts, semantic colors, spacing, radii, shadows, and motion rules.
- Create the responsive application shell and navigation.
- Add truthful demo-data and loading/error boundaries.

### Phase 2 — Dashboard and forecast

- Build the hero financial overview.
- Implement Safe-to-Spend with an explicit calculation and assumptions.
- Build metric cards.
- Implement the cash-flow data model and deterministic forecast calculation.
- Build the responsive forecast chart with scenario overlays.
- Add insight cards, risk indicators, and accessible chart descriptions.

### Phase 3 — Transactions, bills, and Nessie

- Build transaction list, filters, search, quick add, edit, and delete.
- Add bill list, due dates, recurring configuration, and reminders.
- Add photo-based bill capture (Gemini image extraction, pre-filled and user-confirmed, no image storage).
- Integrate Capital One Nessie demo data.
- Add source labels, synchronization status, duplicate protection, and simulated-data disclosures.

### Phase 4 — Gemini and scenario simulator

- Connect Gemini to validated application context.
- Add structured prompt flow and honest processing indicators.
- Add deterministic simulation tools and assumptions.
- Build baseline versus scenario comparison.
- Ensure scenario actions are reversible and do not mutate real records.

### Phase 5 — Budgets, goals, and ledger

- Add budget planning and recommendations.
- Add wishlist and planned AutoSave goals.
- Add money owed/lent ledger and repayment events.
- Add WhatsApp click-to-chat payment reminders for money owed to the user.
- Feed all modules into the same forecast engine.

### Phase 6 — Polish and verification

- Apply consistent component language across all modules.
- Verify responsive layouts at all target widths.
- Verify keyboard and screen-reader behavior.
- Verify loading, empty, success, error, and synchronization states.
- Test build, type checking, linting, and relevant unit/integration tests.
- Trim the Solana wallet-adapter dependency to just the specific wallets actually supported, instead of `@solana/wallet-adapter-wallets`'s catch-all bundle. That package pulls in every adapter including Trezor and React Native/mobile ones this web app never uses, and that unused code is where the critical `protobufjs` and high-severity `braces` npm audit findings live (115 vulnerabilities total after adding Solana, most of them in this dead weight).
- Run the complete three-minute demo flow.
- Document known limitations and demo assumptions.

### Phase 7 — GitHub delivery

- Create the GitHub repository only after confirming its name and visibility.
- Push phases in coherent commits.
- Keep secrets out of Git history.
- Do not add `Co-authored-by` trailers or attribution for GitHub Copilot, Claude, or any other AI tool to commits.

Suggested commit sequence:

1. `chore: initialize CashCompass foundation`
2. `feat: add responsive application shell`
3. `feat: build financial dashboard and forecast`
4. `feat: add transactions bills and Nessie demo data`
5. `feat: integrate Gemini scenario copilot`
6. `feat: add budgets goals and money ledger`
7. `test: verify responsive accessible demo flow`
8. `docs: document setup and demo limitations`

## 20. Quality bar

Before declaring any component finished, ask:

- Does it feel like a premium consumer fintech product?
- Is the primary user action immediately clear?
- Is financial information easy to interpret?
- Is the interface visually consistent with CashCompass?
- Are spacing and typography disciplined?
- Does it work beautifully on mobile?
- Are interactions accessible and understandable?
- Does the UI communicate data source and confidence?
- Does the implementation actually work?
- Could a judge understand its value within seconds?

For every significant design decision, briefly explain whether it improves clarity, trust, usefulness, accessibility, or polish.

## 21. Important constraints and non-goals

- Do not request or store real bank credentials.
- Do not present simulated Nessie data as real connected banking data.
- Do not imply Capital One endorsement.
- Do not invent financial data or projections.
- Do not let Gemini override deterministic calculations.
- Do not claim transfers occurred when AutoSave is only planned.
- Do not silently swallow API or synchronization errors.
- Do not use decorative visuals that obscure financial meaning.
- Do not sacrifice working functionality for visual appearance.
- Do not add unrelated features before the flagship demo is reliable.

## 22. Initial repository state

At handoff creation:

- Workspace path: `/Users/varshithkaki/Desktop/Projects/cashcompass`
- Existing source files: none observed
- Existing Git repository: none observed
- Existing GitHub remote: none observed
- GitHub CLI: installed and authenticated as `varshith-k`
- Repository name and visibility: not yet confirmed

The next model should inspect the workspace again, confirm the desired repository name/visibility, then begin Phase 0 and Phase 1 rather than assuming a framework or creating mock functionality prematurely.
