# Capital One Nessie boundary

Nessie only ever feeds data **into** `FinancialEventRepository` — it's not
a parallel data source the UI reads from directly. Every page that shows
transactions, bills, or the forecast already works whether those events
came from Nessie, Tiger Data, or a manual entry; `source: "nessie"` is
just a label on the event.

## Current state (not connected)

- `client.ts` — real REST calls against the standard Nessie endpoints
  (`/customers/{id}/accounts`, `/accounts/{id}/{purchases,deposits,
  withdrawals,bills}`, `/merchants/{id}`). `isNessieConfigured()` is false
  until `NESSIE_API_KEY` is set.
- `sync.ts` — `syncNessieAccount(accountId)` maps Nessie's records onto
  `FinancialEvent` (purchases/withdrawals → expenses, deposits → income,
  bills → planned expenses) and writes them through the same repository
  everything else uses. Duplicate protection is a natural-key check
  (source + date + amount + counterparty), not an id lookup, so re-syncing
  never doubles a transaction up.
- `actions.ts` — `syncNessie()` Server Action, called from Settings. Without
  a key it returns a truthful "not connected" message rather than
  pretending to sync — see `/settings`.
- The demo data in `src/lib/finance/demo-data.ts` already tags several
  events `source: "nessie"`, standing in for a completed sync so the UI's
  Nessie badges have something to show today.

## Wiring up a real sync

1. Get a Nessie API key (Capital One's hackathon sandbox) and create a
   customer + account with some seed purchases/deposits/bills through
   Nessie's own API or UI.
2. Set `NESSIE_API_KEY` and `NESSIE_ACCOUNT_ID` in `.env.local`.
3. Click "Sync Nessie data" on the Settings page, or call `syncNessie()`.

**Untested against the live API** — written against Nessie's long-stable
REST shape, but not run against a real key. If a field name has drifted,
the fix is isolated to the mapping loops in `sync.ts`; nothing downstream
needs to change since they only ever see a `FinancialEvent`.

## Extending it

"Demo account selection" (letting the user pick among several Nessie
customers/accounts rather than one fixed `NESSIE_ACCOUNT_ID`) is the
obvious next step once a key exists to test it against — `client.ts`
already has `getAccountsForCustomer()` for that.
