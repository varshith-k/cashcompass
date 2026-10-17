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
  interface. Used whenever `DATABASE_URL` is unset.
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

Rerunning the schema safely adds `counterparty_phone`, `source_record_id`, and the Solana receipt table to an existing installation. Keep `types.ts`, the SQL schema, and the row mappings in sync when extending financial events.

## Repository and planning data

The repository supports `listEvents`, `createEvent`, `updateEvent`, and `deleteEvent` in both stores. External record IDs support Nessie import/update protection; counterparty phone numbers persist in both backends. The in-memory repository returns copies so synchronization cannot accidentally mutate or double-append stored events.

Budget allocations and wishlist goal definitions remain per-user memory stores even when events use TimescaleDB. Goal savings schedules and contributions are financial events and therefore use the chosen event backend. These distinctions are visible demo limitations, not durable production planning storage.

## Forecast assumptions

The opening balance is seeded. Posted events across the recorded history determine current modeled funds; planned income is excluded from that current amount. Forecasts include monthly planned bills and dated income/savings/repayments. Uncertain incoming repayments also have a conservative path in which they never arrive. Overdue expenses remain obligations; overdue planned income is not treated as received cash.

Goal progress includes confirmed reserves only. Contributions replace scheduled reserve amounts to avoid counting the same funds twice. AutoSave does not move money. All date buckets use UTC calendar days. See [project status](../../../docs/PROJECT_STATUS.md) for the full assumptions and deployment limits.

## Per-user data (Auth0)

Every repository call is scoped to the signed-in user. `getFinancialEventRepository()` resolves the owner from the verified Auth0 session (`requireOwnerId()` in `src/lib/auth/session.ts`) and passes it to the store, so callers never pass a user id and can't touch another user's rows:

- `tiger-repository.ts` filters every `SELECT`/`UPDATE`/`DELETE` on `owner_id`, and `INSERT` sets it.
- `demo-repository.ts`, `budgets.ts`, `wishlist-goals.ts` and `../nessie/status.ts` keep one in-memory copy per user. Each new user starts from the demo seed.
- Signed-out calls redirect to login.

If you already ran an older `db/schema.sql`, recreate the table. It now has `owner_id text NOT NULL`, and the primary key is `(id, event_date)`, which TimescaleDB requires for hypertables.
