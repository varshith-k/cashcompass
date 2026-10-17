# CashCompass — Project Handoff

> **Your money. Your direction.**

This document is the source of truth for handing CashCompass to another model or developer before implementation begins. It records the product direction, requirements, design language, technical expectations, demo strategy, and phased delivery plan.

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
- Feed all modules into the same forecast engine.

### Phase 6 — Polish and verification

- Apply consistent component language across all modules.
- Verify responsive layouts at all target widths.
- Verify keyboard and screen-reader behavior.
- Verify loading, empty, success, error, and synchronization states.
- Test build, type checking, linting, and relevant unit/integration tests.
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
