# Capital One Nessie sandbox accounts

Nessie simulates banking; no real bank credentials or money are involved. Each authenticated user now gets a separate customer and $0 checking account. Auth0 authenticates identity; CashCompass provisions the Nessie objects after the authenticated app loads. Actual names, emails, addresses, and Auth0 subjects are not sent to Nessie: creation uses a fictional profile and a stable pseudonymous marker.

## Configuration and rollout

1. Configure Auth0, `NESSIE_API_KEY`, and `DATABASE_URL` privately on the deployment. Optional `NESSIE_API_BASE_URL` selects the sandbox endpoint. Use the existing financial schema in `db/schema.sql` for a new Tiger Data service.
2. Existing installations can apply only the additive `db/migrations/20261018_nessie_user_accounts.sql`. The provisioning store also creates this table on first setup if the DB role has permission, serialized across app processes. A pre-migrated installation needs SELECT/INSERT/UPDATE on this table, without runtime CREATE permission. No financial history is deleted or rewritten.
3. On the first authenticated app visit (including existing users), a client invokes an authenticated Server Action. Rendering/prefetching performs only a mapping lookup. Auth0 login itself does not wait for Nessie. Settings has **Set up / recover my sandbox account** for retrying failures.
4. Settings shows only the mapped account, its reference balance, and its shareable account ID. A friend can enter that ID in Settle Up for sandbox P2P payments. New accounts have no seeded activity or funds; a sandbox deposit must be made before paying. Automatic funding is not implemented.

`NESSIE_CUSTOMER_ID` and `NESSIE_ACCOUNT_ID` remain legacy seed-script references. User sync and payments never fall back to them. Without the API key or database, automatic setup is disabled; local demo mode cannot create sandbox accounts. Setup status/errors appear in Settings. The private values must not be committed or pasted into chat.

## Ownership, durability, and retries

`nessie_user_accounts` stores the verified Auth0 subject → customer/account mapping, unique remote IDs, marker, and committed creation-attempt checkpoints. A PostgreSQL session advisory lock serializes each user's setup across tabs, requests, and workers. Repeat visits and application restarts reuse the durable mapping. Account reads verify both the saved account ID and remote customer ID. Sync rejects other account selections; P2P always uses the mapped payer, ignoring stale sync status and global environment IDs. Recipients are explicitly supplied through the user's saved friend.

Checkpoints are committed **before** each remote POST and after customer creation. If a response or database write is lost, retries look for the matching fictional customer or account marker. They adopt exactly one matching object. No match, multiple matches, or an unverifiable owner stops setup for review; it does not blindly POST again. Nessie and Postgres do not provide a joint transaction or a documented creation idempotency key, so an uncertain remote outcome cannot be promised exactly once. An administrator must investigate unresolved attempts in the sandbox before changing checkpoints; never clear them just to retry. DB constraints prevent mapping one account/customer to two users.

Historical imports from the former shared sandbox remain in each user's existing financial records. They are not automatically erased or relabeled. New users start with an empty database-backed event history. Forecasts start at $0 with a database and use recorded events; the sandbox balance is a reference, not an automatic balance reconciliation.

`sync.ts` uses account/type/remote-record IDs to avoid duplicate imports, updates pending/completed records, and skips failed/cancelled activity. Empty sandbox collections support 404 responses while a missing account fails. Import batches are not transactional; concurrent/interrupted imports and remote deletions still need reconciliation. Friends and sync status remain process-local on main; the account mapping itself is durable. Preserve the mapping table in database backups. The new connection pool follows the existing Tiger TLS policy (encrypted, certificate validation disabled), with bounded connection/query timeouts.

## Verification

Unit tests cover ownership, malicious account selections, stale shared payer state, demo/no-DB guards, API creation contracts, ambiguous retries, concurrent setup, and credential-safe errors. Optional integration tests exercise the actual PostgreSQL DDL, unique constraints, locks, durable checkpoints, and store recreation.

Run integration tests only against a disposable localhost database named `cashcompass_nessie_test`, using `NESSIE_TEST_DATABASE_URL`. The test file rejects other hosts/database names and drops only its test mapping table. Clear `DATABASE_URL`, `GEMINI_API_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` when running the full suite. Live provider sign-up, persistence across a production restart, and cross-user sandbox P2P need separate deployment verification; mocked/local tests do not establish live success.

Account balance snapshots and synchronization state now persist in planning_profiles; forecasts reconcile posted imported activity to the latest synchronized sandbox balances.
