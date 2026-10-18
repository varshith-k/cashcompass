# Financial-data boundary

Everything that reads financial events goes through `getFinancialEventRepository()`
in `repository.ts`. UI code and the forecast calculations never call
`demo-data.ts` or a database client directly — that's what makes the Tiger Data
integration a parallel, non-colliding task, the same way `src/lib/auth/` is for
Auth0.

## Current state (demo mode)

- `demo-data.ts` — seed events as day-offsets from "today" (see the comment
  there on why they're offsets, not fixed dates).
- `demo-repository.ts` — wraps `demo-data.ts` behind the `FinancialEventRepository`
  interface. Used in development whenever `DATABASE_URL` is unset. Production requires a database unless ephemeral storage is explicitly enabled; production authentication still requires Auth0.
- `tiger-repository.ts` — a real, working Tiger Data (TimescaleDB on Postgres)
  implementation via `pg`, already written against the schema below. It's
  selected automatically once `DATABASE_URL` is set — no code change needed
  if the schema matches.
- `calculations.ts` — `computeForecast()` / `computeSafeToSpend()`, pure
  functions over `FinancialEvent[]`. These don't care where the events came
  from, so they need no changes either way.

## Wiring up Tiger Data

1. Provision a Tiger Data Cloud service (Postgres + TimescaleDB).
2. Run the migration: `psql "$DATABASE_URL" -f db/schema.sql`. This creates
   the `financial_events` hypertable (time-partitioned on `event_date`, not
   a plain table — that's what makes this a real Tiger Data submission
   rather than "Postgres with extra steps") and a `monthly_category_spend`
   continuous aggregate for the Budgets module and the dashboard's
   "monthly expenses" metric.
3. Set `DATABASE_URL` in `.env.local`. `getFinancialEventRepository()` selects the database automatically.
4. Load events through the manual workflows or Nessie sync. Database mode does not auto-seed the in-memory demo events.

Rerunning the schema adds `counterparty_phone`, `source_record_id`, the Solana receipt table, and `planning_profiles` to an existing installation. `npm run db:migrate` loads environment configuration and executes this schema without printing connection values. Review and back up the target before an approved production migration. Keep `types.ts`, the SQL schema, and the row mappings in sync when extending financial events.

## Repository and planning data

The repository supports `listEvents`, `createEvent`, `updateEvent`, and `deleteEvent` in both stores. External record IDs support Nessie import/update protection; counterparty phone numbers persist in both backends. The in-memory repository returns copies so synchronization cannot accidentally mutate or double-append stored events.

Budget allocations, wishlist goals, balance checkpoints, account snapshots, and Nessie sync state persist per user in `planning_profiles` when `DATABASE_URL` is configured. Goal schedules and contributions are financial events. Development without a database keeps both stores in memory.

`withFinancialTransaction()` resolves the session owner, acquires a per-owner PostgreSQL transaction advisory lock, and shares one client across event, profile, and receipt writes. Bill renewal, savings planning/contributions, ledger settlements, and Nessie reconciliation commit together or roll back together. The demo backend uses a per-owner mutex and drafts that publish only on success. `getFinancialSnapshot()` reads the balance basis and events under the same owner lock.

## Forecast assumptions

Available funds start from a confirmed balance checkpoint or the latest synchronized Nessie balances. A checkpoint offsets existing posted events so they are not counted twice. Account snapshots subtract imported amounts already reflected in the synchronized balance before replaying events. Manual activity is applied separately. A subsequent sync replaces a manual checkpoint. Fresh database users must set a checkpoint or synchronize an account; only the keyless demo has a seeded opening balance.

Posted events across recorded history determine current modeled funds; planned income is excluded. Forecasts include monthly planned bills and dated income/savings/repayments. Uncertain incoming repayments also have a conservative path in which they never arrive. Overdue expenses remain obligations; overdue planned income is not treated as received cash. Nessie snapshots are simulated, can become stale, and are not an atomic snapshot of a real bank ledger.

Goal progress includes confirmed reserves only. Contributions replace scheduled reserve amounts to avoid counting the same funds twice. AutoSave does not move money. All date buckets use UTC calendar days. See [project status](../../../docs/PROJECT_STATUS.md) for the full assumptions and deployment limits.

## Per-user data (Auth0)

Every repository call is scoped to the signed-in user. `getFinancialEventRepository()` resolves the owner from the verified Auth0 session (`requireOwnerId()` in `src/lib/auth/session.ts`) and passes it to the store, so callers never pass a user id and can't touch another user's rows:

- `tiger-repository.ts` filters every `SELECT`/`UPDATE`/`DELETE` on `owner_id`, and `INSERT` sets it.
- In database mode, planning helpers use the same owner-scoped profile and transaction boundary as financial events. In development without a database, events and planning remain separate per-user memory copies initialized from demo defaults.
- Signed-out calls redirect to login.

The schema expects `owner_id text NOT NULL` and primary key `(id, event_date)`, which TimescaleDB requires for hypertables. If an old installation lacks ownership, inspect and migrate its records with an explicit ownership mapping before deployment; do not drop a table containing user data. The readiness endpoint rejects a missing owner column.

Monitoring, backup boundaries and isolated recovery checks: [Tiger operations runbook](../../../docs/operations/TIGER_DATA.md). Do not recreate financial_events to add columns; apply additive schema migrations and verify recovery separately.
