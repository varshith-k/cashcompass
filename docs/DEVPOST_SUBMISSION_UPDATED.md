# CashCompass

**Track smarter. Spend wiser. Save better.**

## Inspiration

The idea for **CashCompass** started with a simple question:

**“Why is managing money so stressful for students, even when we know how much is in our bank accounts?”**

Through conversations with fellow students, one concern came up repeatedly:

**“I have money in my account, but can I actually afford to spend it?”**

A bank balance does not explain what is already committed to rent, groceries, subscriptions, savings, or money owed to friends. A purchase that looks affordable today can leave someone short before their next paycheck.

Shared expenses add another problem. One person pays for dinner, everyone promises to repay them, and the group loses track of who owes what. Calculating a split is only the beginning: people also need a clear record, a way to acknowledge the obligation, and a way to track repayment.

We built CashCompass to connect these decisions. It combines financial forecasting, a Gemini copilot, shared expenses, simulated banking, Devnet payments, and a Roblox financial-literacy companion. Our goal is to help students understand their next financial decision before they make it.

## What it does

### Understand what is safe to spend

The dashboard brings together transactions, upcoming bills, savings goals, and a cash-flow forecast. **Safe to Spend** estimates spending flexibility after accounting for obligations, everyday spending, planned savings, debts, and a financial buffer. Money a friend promises to repay is distinguished from cash already available.

Users can enter upcoming paychecks, including recurring income, and explore how timing changes their forecast. Available funds can come from a confirmed balance checkpoint or synchronized Nessie sandbox balances. Imported activity is reconciled with those balances to avoid counting the same money twice.

### Ask Gemini, then inspect the calculations

The financial copilot answers questions such as:

- “Can I afford a $1,200 laptop today?”
- “Should I wait until my next paycheck?”
- “What happens if my friend repays me late?”
- “How can I plan savings for a goal?”

Gemini interprets the request and explains results grounded in validated financial tools. Our deterministic engine calculates the amounts and forecasts. When Gemini is unavailable, the interface labels its local calculation fallback rather than presenting it as an AI response.

The What-If Simulator lets users compare buying now versus after payday, delaying a bill, receiving a late repayment, and planning savings. Expected and conservative forecasts make the assumptions visible.

### Scan, split, and settle shared expenses

Users can upload a bill or receipt, capture a photo, or use a QR handoff from laptop to phone. Gemini proposes fields such as merchant, amount, date, and category; users review them before saving. Credit-card statements can also provide a minimum payment.

The bill-splitting workflow supports equal, fixed-amount, percentage, and Gemini-assisted allocations. Natural-language instructions can explain who ordered what and how to distribute tax and tip. Server-side validation checks that the final shares reconcile to the bill total.

Shared balances use an acceptance flow. For example, if Alex assigns Sam a $30 share, Alex records a receivable and Sam sees a pending invitation when signed in with the matching verified email. **Sam must accept before the obligation is added to Sam’s financial ledger.** Accepted balances support repayment tracking on both sides, with best-effort payment mirroring.

Settle Up supports partial payments and optional email notifications. Email delivery depends on the configured provider; a saved balance alone does not guarantee an email was delivered.

### Explore banking and blockchain payments safely

CashCompass integrates **Capital One Nessie** for simulated banking. Signed-in Auth0 users can provision their own persisted sandbox customer and checking account from the setup banner or Settings. New accounts start at **$0** and contain no real money.

Account ownership is checked before synchronization and payer selection. Imports cover sandbox purchases, deposits, withdrawals, bills, and transfers. Nessie P2P payments link their transfer identifiers to repayment records so a later synchronization can recognize the same activity.

The **Solana Devnet** settlement flow connects compatible wallets, verifies transfers server-side, and protects transaction signatures from reuse. A signature claim and the payer’s ledger update share a database transaction. If recording fails after a transfer, the recovery flow retains the signature and supports verification without sending another payment.

Solana payments use test SOL, a fixed demonstration conversion rate, and a configured demonstration recipient. This is a prototype settlement flow, not a production payment service or live exchange-rate integration.

### Learn through MoneyQuest

**MoneyQuest**, our Roblox companion, asks: “Can you survive 30 days without going broke?” Players explore four neighborhood stations and make decisions about spending, bills, savings, unexpected expenses, and repayments across six scenarios. Server-controlled Luau logic updates their simulated finances and produces a final score with replay.

The game is separate from personal financial records. Its standalone logic suite exercises **324 complete decision paths with 4,261 assertions**. Public access remains subject to Roblox’s creator eligibility and audience settings; logic tests do not establish that an outside account can join.

## How we built it

### Web application and financial engine

We used **Next.js 16, React 19, TypeScript, Tailwind CSS, and Recharts** for the application, responsive interface, and forecasts. Financial calculations are separate from generated explanations, giving the dashboard, simulator, and copilot a consistent numerical foundation.

### Gemini API

Gemini powers three workflows: conversational financial guidance, bill/receipt field extraction, and natural-language split suggestions. Structured responses are validated before they affect financial records, and extracted fields require user review.

### Auth0

Auth0 provides authentication and protected routes, with email/password and configured Google sign-in. Server-side session identity scopes financial data to the user. The application supports Auth0 MFA; enforcement is controlled by the tenant policy and must be verified separately.

### Tiger Data

Tiger Data provides PostgreSQL and TimescaleDB storage. Financial events live in a time-partitioned hypertable. A monthly category-spend continuous aggregate powers budget queries, with realtime aggregation for recent activity. Compression policies target older chunks; we do not claim a measured compression percentage.

PostgreSQL also persists planning profiles, including budgets, savings goals, balance checkpoints, account snapshots, and sync state. Owner-scoped transactions and advisory locks protect multi-step mutations. Solana receipt claims roll back with failed ledger writes, and financial-date changes preserve records when they cross Timescale chunks.

We added sanitized database health checks, provider metrics tooling, alert-rule templates, and isolated recovery-verification tooling. These operational checks distinguish database health from proof of a successful cloud restore.

### Nessie, Solana, and notifications

Nessie sandbox mappings persist per authenticated user. Provisioning checkpoints and ownership validation help prevent duplicate setup and accidental access to another user’s account. Solana Web3.js and wallet adapters provide the Devnet flow, while the server verifies transfers before recording repayments.

Resend integration supports notifications and scheduled bill reminders. Reminder preferences include lead time, local hour, and time zone. Live delivery requires provider configuration and an installed scheduler.

### Roblox

MoneyQuest uses **Roblox Studio, Luau, and Rojo**, with deterministic server-controlled gameplay and a separate testable simulation engine.

### Vultr deployment

CashCompass runs on **Vultr**, behind Nginx and HTTPS, with PM2 managing the application. A systemd timer checks the main branch and builds candidate releases. Candidate checks and rollback support help preserve the running application if a release fails.

The deployed public health endpoint reports readiness and revision without exposing credentials. Repository tooling also includes optional snapshot automation, a firewall setup script, and an updated deployment script with migration and database-readiness checks. These scripts require explicit installation or configuration; having them in the repository does not establish that every infrastructure protection is enabled.

## Challenges we ran into

**Keeping AI explanations numerically grounded.** Natural language is flexible, but financial calculations need predictable rules. We separated interpretation from calculation and validated structured outputs before using them.

**Avoiding duplicate accounting.** A shared purchase, a repayment obligation, a bank import, and a confirmed payment represent different events. We linked records and reconciled imported balances so the same activity would not become multiple expenses.

**Recovering after a wallet transfer.** A blockchain transfer can succeed while a later application write fails. We added signature retention, verification retries, transactional receipt claims, and support for Timescale updates across date partitions.

**Sharing obligations without imposing them.** Matching a participant’s email is not enough to create an accepted debt. Shared balances remain pending until the authenticated recipient accepts.

**Coordinating persistence and concurrency.** Goals, budgets, events, and receipt claims must remain consistent across restarts and concurrent requests. We moved planning into PostgreSQL and tested rollback and simultaneous payment attempts.

**Connecting several runtimes.** The web app, cloud services, wallet extension, realtime companion, and Roblox game each have different deployment and verification requirements. We learned to distinguish source-level completion, automated tests, and live-service evidence.

## Accomplishments that we're proud of

- A connected dashboard, financial copilot, and reversible simulator centered on the same question: “Can I actually afford this?”
- Shared expense invitations, recipient acceptance, partial repayments, and notification workflows.
- A deployed per-user Nessie integration with persisted sandbox mappings and P2P support.
- A recoverable Solana Devnet settlement implementation with signature-reuse protection.
- Tiger Data persistence, continuous aggregates, and transaction/concurrency safeguards.
- A separate Roblox financial-literacy experience.
- A working HTTPS deployment with a public readiness endpoint and archived release history.

The consolidated release passed **231 unit tests**, **8 database persistence/concurrency tests**, **8 Timescale payment and Nessie mapping integration tests**, and **13 operational tests**. Additional opt-in tests are excluded from the default unit run; they are not counted as passing live-service checks.

Lint, type checking, production builds, and the complete demo workflow passed. Browser verification covered keyboard navigation and layout/accessibility across **nine routes, four viewport widths, and both themes**. The main-branch verification workflow also completed successfully.

## What we learned

Financial clarity depends on explaining both the result and its assumptions. A useful forecast distinguishes a confirmed balance from an expected repayment, and a trustworthy AI interface makes clear when a deterministic fallback is answering.

We also learned that accounting correctness extends beyond arithmetic. Ownership checks, recipient consent, durable storage, idempotency, and recovery after partial failure all affect whether users can trust the result.

Building across Gemini, Auth0, Tiger Data, Nessie, Solana, Vultr, and Roblox taught us to give each integration a specific responsibility and verify its boundaries rather than treating a successful build as proof that every external workflow is complete.

## What's next for CashCompass

We want to improve receipt understanding, add richer repayment notifications, and expand MoneyQuest’s educational scenarios. WhatsApp reminders are currently removed; a future WhatsApp Business integration will provide opt-in automated repayment messages with scheduling, delivery tracking, and unsubscribe controls.

Further work includes individual recipient wallets and exchange-rate handling for payments, broader real-bank connectivity, and additional evidence for complete live settlement, scheduled email delivery, production MFA policy, and outside-account Roblox access. Infrastructure work includes installing and validating optional monitoring, backup, firewall, and recovery configurations where appropriate.

Our long-term goal remains simple: help students understand what they can spend, what they should reserve, and how today’s decisions affect tomorrow.

## Demo and project links

- [CashCompass live application](https://cashcompass.club)
- [Source code](https://github.com/varshith-k/cashcompass)
- [Demo video](https://www.youtube.com/watch?v=PgfMPZerxKE)
- [MoneyQuest Roblox experience](https://www.roblox.com/games/73262786586748/CashCompass-MoneyQuest) — access depends on Roblox audience settings.
- [DEV project article](https://dev.to/varshithk/we-built-cashcompass-in-36-hours-an-ai-financial-copilot-that-predicts-your-financial-future-5gol)

## Built With

Next.js, React, TypeScript, Tailwind CSS, Recharts, Node.js, Google Gemini API, Auth0, Tiger Data, PostgreSQL, TimescaleDB, Capital One Nessie, Solana Web3.js, Solana wallet adapters, Phantom, Resend, Vultr, Nginx, PM2, Docker, Roblox Studio, Luau, Rojo, GitHub Actions.
