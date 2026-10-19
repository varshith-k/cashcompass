# CashCompass

Your money. Your direction. A personal-finance demo built with Next.js 16, React 19, TypeScript, Tailwind, Base UI, and Recharts.

## Run locally

Use Node.js 22 or newer (required by current wallet dependencies) and npm.

```sh
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000/overview>. With Auth0 unset, development uses an isolated, seeded demo user. Demo authentication is disabled in production: configure Auth0 before serving a production build.

## What works

- Dashboard, explained Safe to Spend, expected and conservative cash-flow forecasts.
- Transaction search, filters, creation, editing, and deletion.
- Bills, monthly renewals, and user-confirmed Gemini photo extraction.
- Reversible scenarios and a financial copilot with deterministic result cards.
- Editable budgets, wishlist goals, weekly reserve schedules, and partial repayments.
- Verified Solana **devnet** settlement.
- Optional Capital One Nessie simulated account selection and idempotent imports.

## Integrations

All credentials stay server-side. `.env.example` lists the supported variables.

- [Auth0 setup](docs/AUTH0_SETUP.md)
- [Financial storage and TimescaleDB](src/lib/finance/README.md)
- [Gemini copilot](src/lib/copilot/README.md)
- [Capital One Nessie sandbox](src/lib/nessie/README.md)
- [Solana devnet](src/lib/solana/README.md)

Configure `DATABASE_URL` and run `npm run db:migrate` against the intended TimescaleDB service before starting the app. The schema stores financial events, budgets, goals, balance snapshots, synchronization state, and settlement receipts. Production requires durable storage. Review the [deployment runbook](docs/DEPLOYMENT.md) before changing an existing installation.

## Verify

```sh
npm test
npm run lint
npm run typecheck
npm run build
# Optional, against a disposable local TimescaleDB database:
# TEST_DATABASE_URL=postgresql://postgres@localhost:55433/cashcompass_verification TEST_TIMESCALE=true npm run test:database
# With the development server running:
npm run audit:ui
npm run audit:keyboard
npm run test:demo
```

The UI audit checks nine routes at four widths in both themes, with accessibility scans at mobile and desktop widths. The keyboard audit checks skip navigation, menus, dialog focus traps/return, category selection, theme switching, mobile navigation and unique route titles without saving data. The browser demo checks connected mutations and removes its uniquely named records. These browser checks assume the local keyless demo environment; they do not replace real screen-reader or authenticated production testing.

See [phase status, verification, and limitations](docs/PROJECT_STATUS.md) and the original [product handoff](PROJECT_HANDOFF.md). Forecasts use a confirmed balance checkpoint or synchronized Nessie balances; only the keyless demo uses a seeded balance. Savings reserve funds in the model; they do not transfer money. Nessie records are simulated and do not imply Capital One endorsement.

## Contributors

Built by the CashCompass team for SwampHacks.

## Planned messaging automation

WhatsApp reminders are currently unavailable. A future integration will send opt-in automated repayment reminders through a WhatsApp Business messaging provider, with recipient consent, scheduling, delivery tracking, and unsubscribe controls. Existing email reminders remain available where configured.

Weekly savings plans reserve money in the forecast; they do not transfer funds between accounts.
