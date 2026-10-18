# Tiger Data monitoring and recovery

Operational checks live separately from the financial UI. The health and recovery commands issue read-only SQL in bounded transactions, print metadata/hashes rather than financial records, and never output database URLs, passwords, API keys, or raw driver errors. Environment loading follows Next.js, including ignored `.env.local`; production commands should run with `NODE_ENV=production`.

## Current evidence

See the dated, sanitized [database report](evidence/tiger-health-2026-10-18.json) and [cloud metrics report](evidence/tiger-metrics-2026-10-18.json). These cover the database selected by the local `DATABASE_URL`; they do not establish which database Vultr currently uses.

The live database has a compressed financial hypertable, real-time monthly aggregate, successful scheduled refresh/compression jobs, and encrypted connectivity. The app-compatible TLS policy currently does not require peer certificate validation; no application connection settings were changed. Tiger CLI authentication and a matching service read succeeded. CPU, memory, and disk history are accessible. No recurring monitoring, exporter, alert routing, backup-history confirmation, or live recovery drill has been installed/completed by this change.

## Repeat database checks

```sh
npm run tiger:health
npm run tiger:metrics
```

The first command inspects application tables, Timescale policies, current connection pressure/blocked or old transactions, cumulative statistics, and archiver observations. The second reads the matching service through authenticated Tiger CLI, summarizes the last 15 minutes of primary CPU/memory/disk samples, and refuses to choose an arbitrary default service. It does not change the CLI default service.

`status: ok` in a database health report means the implemented SQL checks passed. `backupCoverageVerified: false` remains explicit until provider evidence and a successful restore exist. An archiver counter, snapshot listing, or successful database connection is not a restore test. Job failures and missing required schema cause nonzero health exits. Optional/permission-limited observations remain unknown. Metric read failures/missing series produce a partial report and nonzero exit.

For one-off checks from the operations worktree, run its script by absolute path **with the current working directory set to the project containing your private env file**. Do not copy private env files into the worktree or Git.

## CLI access

Use an interactive terminal in the same environment as the project. The [official CLI instructions](https://github.com/timescale/tiger-cli#installation) provide Windows PowerShell and macOS/Linux installation options. Run `tiger auth login`, authorize in your own browser, and select the correct project. Use `tiger auth login --headless` if no local browser is available. Keep login tokens local. Do not print connection-string commands or use `--with-password` in shared logs. This delivery was checked with Tiger CLI 0.26.0.

## Recurring monitoring and alerts

Prepare the managed exporter through Console → Exporters → New exporter, enable PostgreSQL metrics, and attach it under the service's Operations → Exporters. The [Prometheus integration guide](https://www.tigerdata.com/docs/integrate/observability-alerting/prometheus) documents plan requirements; verify actual provider/plan availability in Console before changing the subscription. Creating an exporter or hosted metrics service may require billing approval. This change does not install services on Vultr.

Use [prometheus.example.yml](../../ops/monitoring/prometheus.example.yml) and [tiger-alerts.yml](../../ops/monitoring/tiger-alerts.yml) in an existing Prometheus installation. Replace the reserved example host, exact metrics path, and username with Console values; mount the exporter password as a private file. Prometheus does not substitute shell environment variables in this YAML. Keep private config outside Git. Review the scrape's `project_id`, `service_id`, `role`, and `region` labels; attach only the intended service. Change `datname="tsdb"` if your application database uses another name.

Eight rules cover exporter failure, missing scrape/PG metrics, database unavailability, sustained CPU/memory pressure, long transactions, and new archiver failures. Thresholds are starting values to tune against normal traffic. RAM includes cache; inspect sustained pressure before resizing. CPU/memory are grouped by service/role. Use the disk-usage series with your actual storage limit/billing settings rather than assuming an unexported disk capacity metric exists. The metric names and units come from [Tiger's exported metrics reference](https://www.tigerdata.com/docs/integrate/observability-alerting/exported-metrics).

Rules alone do not notify anyone: connect your existing Alertmanager and a chosen recipient/channel, then test routing with a temporary test alert. No messages are sent by these scripts. Verify `up`, `pg_up`, expected service labels, data freshness, and one intentional notification before marking monitoring installed. Run the supplied rule tests and syntax validation with `promtool` before reloading your collector.

## Backup coverage record

In Console → service → Operations → Backup and restore, record these facts with the verification time:

| Evidence | What to record |
| --- | --- |
| Service and account scope | Service ID privately, provider/region, plan, DEV/PROD designation; confirm it matches the app's DB. |
| Backup inventory | Most recent successful full/incremental backup, failures, and current status. |
| Recovery window | Configured retention and **actual** earliest/latest recoverable UTC timestamps, including gaps or an unfilled new retention window. |
| Regional protection | Whether cross-region backup is enabled and its own region/retention. |
| Restore availability | Whether timestamp recovery forks are offered by this plan/service now. |
| Verification owner | Person, date, recovery point objective (acceptable data loss), recovery time objective (acceptable downtime), and next drill date. |

The [backup/restore guide](https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/high-availability/backup-restore) describes managed full/incremental backups and retained WAL, plus plan-dependent history, retention and regional protection. The [feature comparison](https://www.tigerdata.com/docs/get-started/feature-comparison) distinguishes managed Cloud and self-hosting; it does not prove settings for this service. Never change retention or pause/delete the original just to run a test. Shortening retention can remove recoverable history. Account-level history/window remains unverified until the record above is filled.

## Point-in-time recovery drill

Use **two temporary isolated services**: a drill source cloned from the protected app database, then a timestamp recovery fork of that drill source. This avoids deleting or modifying live financial records. Creating these services consumes compute/storage or trial credits; obtain owner approval of their Console configuration/cost and cleanup window first. Do not upgrade the plan automatically. The verifier cannot create, pause, delete, or cut over a service.

1. Confirm the plan supports recovery forks. Save the coverage record above. Approve the temporary resources and maximum lifetime (for example, 30 minutes after each becomes ready); do not promise a price without the actual Console quote.
2. Create the drill source as a **DEV** fork with the reviewed compute size. CLI `tiger service fork <source-id> --no-set-default --environment DEV` is supported by the checked version; review `--help` and the actual resource/billing choices first. Never omit `--no-set-default`. Leave the app's `DATABASE_URL` unchanged. Do not launch CashCompass, email cron, Nessie sync or other external side effects against either clone.
3. Put the drill-source connection privately in `TIGER_DRILL_DATABASE_URL`. Choose a fresh UUID (`node -p 'require("node:crypto").randomUUID()'`). Connect a SQL editor **to that isolated drill source**, and run the following with your UUID substituted:

```sql
BEGIN;
CREATE SCHEMA IF NOT EXISTS cashcompass_recovery_probe;
CREATE TABLE IF NOT EXISTS cashcompass_recovery_probe.checkpoints (
  run_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('before', 'after')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (run_id, phase)
);
INSERT INTO cashcompass_recovery_probe.checkpoints (run_id, phase)
VALUES ('REPLACE-WITH-FRESH-UUID', 'before');
COMMIT;
SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS target_utc;
```

4. Copy `target_utc` as an ISO timestamp ending in `Z`. The explicit commit above must finish before this target is selected. Allow at least one second between the before marker, target selection, and after marker so millisecond precision cannot make their timestamps equal. In a **separate** SQL execution after that target time, add the after marker, committing it as well:

```sql
BEGIN;
INSERT INTO cashcompass_recovery_probe.checkpoints (run_id, phase)
VALUES ('REPLACE-WITH-SAME-UUID', 'after');
COMMIT;
```

5. Confirm the drill source's actual recovery window now includes the target. If it does not, wait/check backup readiness without creating duplicate resources. From **the drill source**, create a recovery fork at that exact UTC time through Operations → Service management → Create recovery fork, or the reviewed CLI `--to-timestamp <ISO-time> --no-set-default --environment DEV` options. Record requested target, creation start, ready time, and resulting service ID privately. No source pause or app cutover is needed for a test.
6. Put that fork's connection privately in `TIGER_RECOVERY_DATABASE_URL`. The protected primary, drill and recovered service must have three distinct hosts; the verifier checks this **before connecting** and never connects to the protected `DATABASE_URL`.
7. With no application writes to either clone, run:

```sh
npm run tiger:recovery:check -- --run-id YOUR-UUID --target-time 2026-10-18T12:00:00.000Z
```

The example time must be replaced with the actual recorded target. Passing requires: source before/after timestamps strictly bracket that target; the recovered fork contains only the matching before marker; core application tables/aggregate exist; schema presence agrees; and bounded content fingerprints/row counts agree for financial events, reminder settings and Solana claims, plus Nessie mappings if present. It verifies at most 10,000 rows per table; larger tables report incomplete evidence and fail rather than silently claim a full integrity comparison. Hashes contain no record contents. A matched row count by itself is insufficient.

8. Inspect the restored continuous aggregate/policy configuration with `tiger:health` against the clone in a private, isolated environment. Timescale jobs may run independently on a restored service, so review retention jobs before accepting larger datasets. Do not run production notification schedulers. Record measured restore duration and whether it met the chosen RTO/RPO. A bracketed marker test confirms this drill, not an always-on SLA or an exact provider recovery timestamp without the Console record.
9. After reviewing results and obtaining cleanup approval, remove only the two specifically identified temporary services, clear their private URLs, and record cleanup. Verify the protected app database and `DATABASE_URL` are unchanged. Never bulk-delete by a name substring or use the CLI's default service for deletion.

No live PITR test is recorded as passed until steps 1–9 have real evidence. A local fixture or unit test proves the verifier behavior, not the cloud provider's backup recovery.

## Coverage outside the database

Cloud database backups cover persisted financial events, reminders, Solana claims and Nessie mappings if that table exists. They do not back up Auth0 configuration, Gemini/Nessie provider state, Vultr release/environment files, Roblox publishing assets, email-provider settings, or the process-local budgets, goal definitions, friends and sync status. Keep secrets in an appropriate private backup system, keep source/assets in version control, and restore runtime configuration separately. Do not copy production secrets into a recovery clone's app process.
