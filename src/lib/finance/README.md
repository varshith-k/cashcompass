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
3. Seed it with data — either adapt `demo-data.ts`'s templates into `INSERT`
   statements, or load real Nessie-sourced records once Phase 3 lands.
4. Set `DATABASE_URL` in `.env.local` (see `.env.example`). That's it —
   `getFinancialEventRepository()` picks `tiger-repository.ts` automatically.

## Extending the interface

`FinancialEventRepository` only has `listEvents()` today because that's all
the Overview dashboard needs. Phase 3 (transactions/bills) and Phase 5
(budgets/wishlist/ledger) will need more — a category/month aggregate read
(backed by `monthly_category_spend`), and a write path for quick-add and
manual entries. Add those methods to the interface in `repository.ts` first,
then implement them in both `demo-repository.ts` and `tiger-repository.ts` —
keeping both in sync is what lets the app run with or without a live Tiger
Data connection.

If `FinancialEvent` in `types.ts` ever changes, update `db/schema.sql` and
the row mapping in `tiger-repository.ts` to match — they're hand-kept in
sync, not generated from each other.

## Per-user data (Auth0)

Every repository call is scoped to the signed-in user. `getFinancialEventRepository()` resolves the owner from the verified Auth0 session (`requireOwnerId()` in `src/lib/auth/session.ts`) and passes it to the store, so callers never pass a user id and can't touch another user's rows:

- `tiger-repository.ts` filters every `SELECT`/`UPDATE`/`DELETE` on `owner_id`, and `INSERT` sets it.
- `demo-repository.ts`, `budgets.ts`, `wishlist-goals.ts` and `../nessie/status.ts` keep one in-memory copy per user. Each new user starts from the demo seed.
- Signed-out calls redirect to login.

If you already ran an older `db/schema.sql`, recreate the table. It now has `owner_id text NOT NULL`, and the primary key is `(id, event_date)`, which TimescaleDB requires for hypertables.
