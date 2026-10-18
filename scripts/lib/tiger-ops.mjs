import { Pool } from 'pg';

export const CORE_TABLES = ['financial_events', 'solana_settlement_receipts', 'bill_reminders'];
export const OPTIONAL_TABLES = ['nessie_user_accounts'];
export const MAX_FINGERPRINT_ROWS = 10000;

export function safeError(error) {
  const value = error?.code || error?.cause?.code;
  return typeof value === 'string' && /^[A-Z0-9_]{2,40}$/.test(value) ? value : 'CHECK_FAILED';
}

export function connectionIdentity(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) throw new Error('Invalid database configuration');
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

export function assertIsolatedRecoveryTargets(primary, drill, recovered) {
  if (!primary || !drill || !recovered) throw new Error('DATABASE_URL, TIGER_DRILL_DATABASE_URL, and TIGER_RECOVERY_DATABASE_URL are required');
  const hosts = [primary, drill, recovered].map(connectionIdentity);
  if (new Set(hosts).size !== 3) throw new Error('The protected primary, drill service, and recovery fork must have distinct hosts');
}

export function createPool(connectionString) {
  connectionIdentity(connectionString);
  const pool = new Pool({ connectionString, max: 1, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000, query_timeout: 10000, application_name: 'cashcompass-readonly-operations' });
  pool.on('error', () => {}); // The CLI reports sanitized failures; never log URLs/errors.
  return pool;
}

export async function readOnly(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '8s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL datestyle = 'ISO, YMD'");
    return await work(client);
  } finally {
    // Discard the connection even if a timed-out query or rollback has an unknown result.
    try { await client.query('ROLLBACK'); } finally { client.release(true); }
  }
}

export async function collectHealth(client) {
  const checks = [];
  async function check(id, required, query, evaluate) {
    await client.query('SAVEPOINT health_check');
    try {
      const result = await client.query(query);
      checks.push({ id, ...evaluate(result.rows) });
      await client.query('RELEASE SAVEPOINT health_check');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT health_check');
      await client.query('RELEASE SAVEPOINT health_check');
      checks.push({ id, status: required ? 'fail' : 'unknown', errorCode: safeError(error) });
    }
  }
  await check('connection', true, `SELECT pg_is_in_recovery() AS standby,
    (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls_encrypted,
    pg_database_size(current_database())::text AS database_bytes`, rows => ({ status: rows[0].tls_encrypted ? 'ok' : 'warn', ...rows[0], tlsPeerVerificationRequired: Boolean(client.connectionParameters?.ssl && client.connectionParameters.ssl.rejectUnauthorized !== false) }));
  await check('schema', true, `SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest(ARRAY['financial_events','monthly_category_spend','solana_settlement_receipts','bill_reminders','nessie_user_accounts']) AS name`, rows => ({ status: rows.filter(row => row.name !== 'nessie_user_accounts').every(row => row.present) ? 'ok' : 'fail', tables: Object.fromEntries(rows.map(row => [row.name, row.present])), optionalTables: OPTIONAL_TABLES }));
  await check('hypertable', true, `SELECT compression_enabled FROM timescaledb_information.hypertables WHERE hypertable_schema=current_schema() AND hypertable_name='financial_events'`, rows => ({ status: rows.length === 1 && rows[0].compression_enabled ? 'ok' : 'fail', present: rows.length === 1, compressionEnabled: rows[0]?.compression_enabled ?? false }));
  await check('continuous_aggregate', true, `SELECT materialized_only FROM timescaledb_information.continuous_aggregates WHERE view_schema=current_schema() AND view_name='monthly_category_spend'`, rows => ({ status: rows.length === 1 && !rows[0].materialized_only ? 'ok' : 'fail', present: rows.length === 1, realTimeAggregation: rows[0] ? !rows[0].materialized_only : false }));
  await check('timescale_policies', true, `WITH relations AS (
    SELECT current_schema() AS schema_name, 'financial_events' AS table_name
    UNION ALL SELECT view_schema, view_name FROM timescaledb_information.continuous_aggregates
      WHERE view_schema=current_schema() AND view_name='monthly_category_spend'
    UNION ALL SELECT materialization_hypertable_schema, materialization_hypertable_name
      FROM timescaledb_information.continuous_aggregates WHERE view_schema=current_schema() AND view_name='monthly_category_spend'
    ) SELECT j.job_id, j.proc_name, j.scheduled, j.schedule_interval::text,
      s.last_run_status, s.last_successful_finish, s.next_start, s.total_failures::text
    FROM timescaledb_information.jobs j JOIN relations r ON j.hypertable_schema=r.schema_name AND j.hypertable_name=r.table_name
    LEFT JOIN timescaledb_information.job_stats s USING (job_id) ORDER BY j.job_id`, rows => {
      const policiesPresent = rows.some(row => /compression|columnstore/.test(row.proc_name)) && rows.some(row => row.proc_name === 'policy_refresh_continuous_aggregate');
      const failed = rows.some(row => !row.scheduled || row.last_run_status === 'Failed');
      return { status: !policiesPresent || failed ? 'fail' : rows.some(row => !row.last_successful_finish) ? 'warn' : 'ok', policiesPresent, jobs: rows };
    });
  await check('connections', false, `SELECT
    count(*) FILTER (WHERE backend_type='client backend')::int AS client_connections,
    count(*) FILTER (WHERE datname=current_database() AND state='idle in transaction')::int AS idle_transactions,
    count(*) FILTER (WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid))>0)::int AS blocked_connections,
    count(*) FILTER (WHERE datname=current_database() AND xact_start<now()-interval '2 minutes' AND pid<>pg_backend_pid())::int AS transactions_over_2m,
    current_setting('max_connections')::int-current_setting('superuser_reserved_connections')::int-COALESCE(NULLIF(current_setting('reserved_connections',true),''),'0')::int AS usable_connection_limit
    FROM pg_stat_activity`, rows => {
      const row = rows[0];
      const utilizationPercent = Math.round(100 * row.client_connections / Math.max(1, row.usable_connection_limit));
      return { status: utilizationPercent >= 80 || row.blocked_connections > 0 || row.transactions_over_2m > 0 || row.idle_transactions > 0 ? 'warn' : 'ok', ...row, utilizationPercent };
    });
  await check('database_counters', false, `SELECT deadlocks::text, xact_commit::text, xact_rollback::text, blks_hit::text, blks_read::text, temp_bytes::text, stats_reset FROM pg_stat_database WHERE datname=current_database()`, rows => ({ status: 'ok', counters: rows[0], note: 'Cumulative counters since stats_reset; compare rates rather than treating historical totals as current incidents.' }));
  await check('wal_archiver_observation', false, `SELECT current_setting('archive_mode') AS archive_mode, archived_count::text, failed_count::text, last_archived_time, last_failed_time, stats_reset FROM pg_stat_archiver`, rows => ({ status: 'unknown', ...rows[0], note: 'PostgreSQL archiver statistics do not establish managed backup coverage or PITR availability.' }));
  checks.push({ id: 'backup_coverage', status: 'unknown', note: 'Confirm plan, backup history, retention, earliest/latest recoverable UTC time, and cross-region settings in Tiger Console/CLI. SQL connectivity is not backup or restore evidence.' });
  return { capturedAt: new Date().toISOString(), status: checks.some(check => check.status === 'fail') ? 'fail' : checks.some(check => check.status === 'warn') ? 'warn' : 'ok', backupCoverageVerified: false, checks };
}

export function validateRecoveryInput(runId, targetTime) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId || '')) throw new Error('A UUID --run-id is required');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(targetTime || '') || !Number.isFinite(Date.parse(targetTime))) throw new Error('An ISO --target-time with explicit timezone is required');
  return new Date(targetTime).toISOString();
}

export async function recoverySnapshot(client, runId) {
  const probes = await client.query('SELECT phase, created_at FROM cashcompass_recovery_probe.checkpoints WHERE run_id=$1 ORDER BY created_at', [runId]);
  const schema = await client.query(`SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest(ARRAY['financial_events','monthly_category_spend','solana_settlement_receipts','bill_reminders','nessie_user_accounts']) AS name`);
  const fingerprints = {};
  for (const name of [...CORE_TABLES, ...OPTIONAL_TABLES]) {
    if (!schema.rows.find(row => row.name === name)?.present) continue;
    // Names come only from the fixed allowlist. Bound memory/CPU, never print records.
    const { rows } = await client.query(`SELECT count(*)::int AS sampled_rows,
      md5(COALESCE(string_agg(md5(row_to_json(sample)::text), '' ORDER BY md5(row_to_json(sample)::text)), '')) AS digest
      FROM (SELECT * FROM ${name} LIMIT ${MAX_FINGERPRINT_ROWS + 1}) sample`);
    fingerprints[name] = rows[0].sampled_rows > MAX_FINGERPRINT_ROWS ? { status: 'over_limit' } : { status: 'complete', rows: rows[0].sampled_rows, digest: rows[0].digest };
  }
  return { probes: probes.rows.map(row => ({ phase: row.phase, createdAt: new Date(row.created_at).toISOString() })), schema: Object.fromEntries(schema.rows.map(row => [row.name, row.present])), fingerprints };
}

export function evaluateRecovery(source, fork, targetTime) {
  const before = source.probes.find(probe => probe.phase === 'before');
  const after = source.probes.find(probe => probe.phase === 'after');
  const bracketed = Boolean(source.probes.length === 2 && before && after && Date.parse(before.createdAt) < Date.parse(targetTime) && Date.parse(targetTime) < Date.parse(after.createdAt));
  const probesRecovered = Boolean(before && fork.probes.length === 1 && fork.probes[0].phase === 'before' && fork.probes[0].createdAt === before.createdAt);
  const requiredSchema = [...CORE_TABLES, 'monthly_category_spend'].every(name => source.schema[name] && fork.schema[name]);
  const schemaMatches = JSON.stringify(source.schema) === JSON.stringify(fork.schema);
  const expectedFingerprints = [...CORE_TABLES, ...OPTIONAL_TABLES.filter(name => source.schema[name])];
  const complete = expectedFingerprints.every(name => source.fingerprints[name]?.status === 'complete' && fork.fingerprints[name]?.status === 'complete');
  const dataMatches = JSON.stringify(source.fingerprints) === JSON.stringify(fork.fingerprints);
  return { status: bracketed && probesRecovered && requiredSchema && schemaMatches && complete && dataMatches ? 'pass' : 'fail', targetTime, bracketed, beforePresentAfterAbsent: probesRecovered, requiredSchemaPresent: requiredSchema, schemaMatches, boundedFingerprintsComplete: complete, dataMatches, note: 'An isolated drill result, not a production cutover or an SLA. Record the provider recovery-fork settings and measured restore duration separately.' };
}
