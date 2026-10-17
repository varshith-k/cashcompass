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
- Grounded WhatsApp reminder links and verified Solana **devnet** settlement.
- Optional Capital One Nessie simulated account selection and idempotent imports.

## Integrations

All credentials stay server-side. `.env.example` lists the supported variables.

- [Auth0 setup](docs/AUTH0_SETUP.md)
- [Financial storage and TimescaleDB](src/lib/finance/README.md)
- [Gemini copilot](src/lib/copilot/README.md)
- [Capital One Nessie sandbox](src/lib/nessie/README.md)
- [Solana devnet](src/lib/solana/README.md)

Run `db/schema.sql` on your TimescaleDB service before setting `DATABASE_URL`. It also upgrades existing installations with phone numbers, external record IDs, and settlement receipts. Budget and goal definitions remain process-local, even with a database configured.

## Verify

```sh
npm test
npm run lint
npm run typecheck
npm run build
# With the development server running:
npm run audit:ui
npm run test:demo
```

The UI audit checks nine routes at four widths in both themes, with accessibility scans at mobile and desktop widths. The browser demo checks connected mutations and removes its uniquely named records. It assumes the local keyless demo environment.

See [phase status, verification, and limitations](docs/PROJECT_STATUS.md) and the original [product handoff](PROJECT_HANDOFF.md). Forecasts use a disclosed seeded opening balance, not a reconciled banking balance. Savings reserve funds in the model; they do not transfer money. Nessie records are simulated and do not imply Capital One endorsement.

## Contributors

Built by the CashCompass team for SwampHacks.
