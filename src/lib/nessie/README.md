# Capital One Nessie demo data

Nessie is an optional source for the signed-in user's `FinancialEventRepository`. All banking records are simulated. No real bank credentials are requested.

1. Create a sandbox customer/account with records and obtain a Nessie key.
2. Set `NESSIE_API_KEY` and either `NESSIE_CUSTOMER_ID` (account chooser) or `NESSIE_ACCOUNT_ID` (fixed account). `NESSIE_API_BASE_URL` is optional.
3. Open Settings, select a configured sandbox account, and synchronize.

Settings displays synchronized sandbox balances. The forecast offsets imported posted amounts already reflected in each account snapshot before replaying events, so imports do not count them twice. Manual records apply separately. A sync replaces a manually confirmed checkpoint; snapshots can become stale and are simulated data. Each user imports the shared sandbox records into their own scoped repository. Imports, cancelled-record removal, account snapshots and sync status commit in one owner-scoped transaction and persist when `DATABASE_URL` is configured.

`sync.ts` uses account/type/remote-record IDs to preserve identical purchases and avoid duplicate imports. Re-sync updates existing records, including pending → completed transitions. Cancelled/failed records are not imported. Natural keys support old imports that predate external IDs. Manual edits to imported records can be overwritten by later syncs.

`accounts.ts` restricts selectable IDs to the server-configured customer/account. `actions.ts` authenticates before access, exposes failures, records sync counts, and refreshes dependent routes. Requests have timeouts and bypass the fetch cache.

The local tests mock Nessie contracts. Live sync remains unverified without sandbox credentials. Import batches and multi-record changes are not a database transaction; concurrent or interrupted imports need stronger transactional guarantees for production. Remote deletions/cancellations of previously imported records are not currently reconciled automatically.
