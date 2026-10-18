import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolatedRecoveryTargets, collectHealth, CORE_TABLES, evaluateRecovery, readOnly, recoverySnapshot, safeError, validateRecoveryInput } from '../../scripts/lib/tiger-ops.mjs';

const runId = '919a61f2-c9a2-4fe0-9898-d38750ea4318';
const target = '2026-10-18T12:00:00.000Z';
function snapshot() {
  return { probes: [{ phase: 'before', createdAt: '2026-10-18T11:59:00.000Z' }, { phase: 'after', createdAt: '2026-10-18T12:01:00.000Z' }], schema: Object.fromEntries([...CORE_TABLES,'monthly_category_spend'].map(name => [name,true])), fingerprints: Object.fromEntries(CORE_TABLES.map(name => [name,{status:'complete',rows:2,digest:'same'}])) };
}
test('an isolated recovery requires three distinct database service hosts', () => {
  const url = host => `postgres://user:password@${host}/tsdb`;
  assert.doesNotThrow(() => assertIsolatedRecoveryTargets(url('primary.example'),url('drill.example'),url('fork.example')));
  assert.throws(() => assertIsolatedRecoveryTargets(url('primary.example'),url('PRIMARY.example.'),url('fork.example')));
  assert.throws(() => assertIsolatedRecoveryTargets(url('primary.example'),url('drill.example'),url('drill.example')));
  assert.throws(() => assertIsolatedRecoveryTargets(url('primary.example'),'',url('fork.example')));
});
test('recovery arguments require an explicit timezone and a UUID', () => {
  assert.equal(validateRecoveryInput(runId,'2026-10-18T14:00:00+02:00'),target);
  assert.throws(() => validateRecoveryInput(runId,'2026-10-18 12:00:00'));
  assert.throws(() => validateRecoveryInput('not-a-run',target));
  assert.throws(() => validateRecoveryInput(runId,'2026-99-18T12:00:00Z'));
});
test('matching current databases are not proof of point-in-time recovery', () => {
  const source=snapshot();
  assert.equal(evaluateRecovery(source,structuredClone(source),target).status,'fail');
});
test('a recovery must retain the before marker, exclude after, and match schema/content', () => {
  const source=snapshot(), fork=structuredClone(source); fork.probes.pop();
  assert.equal(evaluateRecovery(source,fork,target).status,'pass');
  fork.fingerprints.financial_events.digest='changed';
  assert.equal(evaluateRecovery(source,fork,target).status,'fail');
});
test('missing evidence or over-limit fingerprints fail instead of yielding false success', () => {
  const source=snapshot(), fork=structuredClone(source); fork.probes.pop();
  for(const change of [value=>{value.fingerprints={};},value=>{value.fingerprints.financial_events.status='over_limit';},value=>{value.schema.bill_reminders=false;},value=>{value.probes[0].createdAt='2026-10-18T11:00:00Z';}]) {
    const altered=structuredClone(fork);change(altered);
    assert.equal(evaluateRecovery(source,altered,target).status,'fail');
  }
  assert.equal(evaluateRecovery(source,fork,'2026-10-18T12:02:00Z').status,'fail');
});
test('transactions are read-only and discard connections even if work or rollback fails', async () => {
  const queries=[],releases=[];
  const client={query:async sql=>{queries.push(sql);if(sql==='ROLLBACK')throw Object.assign(new Error('private URL'),{code:'08006'});},release:destroy=>releases.push(destroy)};
  await assert.rejects(readOnly({connect:async()=>client},async()=>{throw new Error('failure');}));
  assert.match(queries[0],/REPEATABLE READ READ ONLY/);
  assert.equal(queries.at(-1),'ROLLBACK');
  assert.deepEqual(releases,[true]);
});
test('health check errors recover to savepoints and never expose raw database errors', async () => {
  const privateValue='postgres://private:secret@host/database';
  const queries=[];
  const report=await collectHealth({query:async sql=>{
    queries.push(sql);
    if(sql==='SAVEPOINT health_check'||sql.includes('SAVEPOINT health_check'))return {rows:[]};
    throw Object.assign(new Error(privateValue),{code:'42501'});
  }});
  assert.equal(report.backupCoverageVerified,false);
  assert.equal(report.status,'fail');
  assert.ok(queries.some(sql=>sql==='ROLLBACK TO SAVEPOINT health_check'));
  assert.equal(JSON.stringify(report).includes(privateValue),false);
  assert.equal(safeError(new Error(privateValue)),'CHECK_FAILED');
});
test('recovery snapshots contain bounded hashes, not financial records, and parameterize the run id', async () => {
  const queries=[];
  const result=await recoverySnapshot({query:async(sql,values)=>{
    queries.push({sql,values});
    if(sql.includes('checkpoints'))return {rows:[{phase:'before',created_at:new Date('2026-10-18T11:59:00Z')}]};
    if(sql.includes('unnest'))return {rows:[{name:'financial_events',present:true}]};
    return {rows:[{sampled_rows:10001,digest:'not-reported'}]};
  }},runId);
  assert.equal(queries[0].sql.includes('$1'),true);
  assert.deepEqual(queries[0].values,[runId]);
  assert.match(queries.at(-1).sql,/LIMIT 10001/);
  assert.deepEqual(result.fingerprints.financial_events,{status:'over_limit'});
  assert.equal(JSON.stringify(result).includes('not-reported'),false);
});

test('a good health report still cannot certify backup coverage', async () => {
  const report=await collectHealth({query:async sql=>{
    if(sql.includes('SAVEPOINT'))return {rows:[]};
    if(sql.includes('pg_is_in_recovery'))return {rows:[{tls_encrypted:true}]};
    if(sql.includes('unnest'))return {rows:[...CORE_TABLES,'monthly_category_spend'].map(name=>({name,present:true}))};
    if(sql.includes('SELECT compression_enabled'))return {rows:[{compression_enabled:true}]};
    if(sql.includes('SELECT materialized_only'))return {rows:[{materialized_only:false}]};
    if(sql.includes('WITH relations'))return {rows:[{proc_name:'policy_compression',scheduled:true,last_run_status:'Success',last_successful_finish:'today'},{proc_name:'policy_refresh_continuous_aggregate',scheduled:true,last_run_status:'Success',last_successful_finish:'today'}]};
    if(sql.includes('client_connections'))return {rows:[{client_connections:2,usable_connection_limit:90,idle_transactions:0,blocked_connections:0,transactions_over_2m:0}]};
    return {rows:[{}]};
  }});
  assert.equal(report.status,'ok');
  assert.equal(report.backupCoverageVerified,false);
  assert.equal(report.checks.find(check=>check.id==='backup_coverage').status,'unknown');
});
