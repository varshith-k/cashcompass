import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { evaluateRecovery, readOnly, recoverySnapshot } from '../../scripts/lib/tiger-ops.mjs';
const connectionString=process.env.TIGER_OPS_TEST_DATABASE_URL;
if(connectionString){const url=new URL(connectionString);if(url.hostname!=='127.0.0.1'||url.pathname!=='/cashcompass_operations_test')throw new Error('Use only the disposable localhost operations test database');}

test('SQL snapshot fixture verifies fingerprints, canary recovery, and read-only enforcement; this is not a cloud restore', {skip:!connectionString}, async()=>{
 const pool=new Pool({connectionString,ssl:false,max:1,connectionTimeoutMillis:5000});
 const runId='919a61f2-c9a2-4fe0-9898-d38750ea4318';
 try{
  await pool.query(`CREATE TABLE financial_events(id text PRIMARY KEY,amount numeric);
   CREATE TABLE bill_reminders(id text PRIMARY KEY,email text);
   CREATE TABLE solana_settlement_receipts(signature text PRIMARY KEY);
   CREATE TABLE nessie_user_accounts(owner_id text PRIMARY KEY,account_id text);
   CREATE VIEW monthly_category_spend AS SELECT sum(amount) AS total FROM financial_events;
   CREATE SCHEMA cashcompass_recovery_probe;
   CREATE TABLE cashcompass_recovery_probe.checkpoints(run_id uuid,phase text,created_at timestamptz);
   INSERT INTO financial_events VALUES('fixture',12.34);
   INSERT INTO bill_reminders VALUES('fixture','private-fixture@example.com');
   INSERT INTO nessie_user_accounts VALUES('private-owner','private-account');`);
  await pool.query('INSERT INTO cashcompass_recovery_probe.checkpoints VALUES ($1,\'before\',\'2026-10-18T11:59:00Z\'),($1,\'after\',\'2026-10-18T12:01:00Z\')',[runId]);
  const source=await readOnly(pool,client=>recoverySnapshot(client,runId));
  assert.equal(source.fingerprints.financial_events.rows,1);
  assert.equal(source.fingerprints.nessie_user_accounts.rows,1);
  assert.doesNotMatch(JSON.stringify(source),/private-fixture|private-owner|private-account/);
  await assert.rejects(readOnly(pool,client=>client.query('DELETE FROM financial_events')),error=>error.code==='25006');
  assert.equal(evaluateRecovery(source,source,'2026-10-18T12:00:00Z').status,'fail');
  // Simulates an older restored fixture state in a disposable DB, not provider recovery.
  await pool.query("DELETE FROM cashcompass_recovery_probe.checkpoints WHERE phase='after'");
  const fork=await readOnly(pool,client=>recoverySnapshot(client,runId));
  assert.equal(evaluateRecovery(source,fork,'2026-10-18T12:00:00Z').status,'pass');
  await pool.query('UPDATE financial_events SET amount=99');
  const altered=await readOnly(pool,client=>recoverySnapshot(client,runId));
  assert.equal(evaluateRecovery(source,altered,'2026-10-18T12:00:00Z').status,'fail');
 }finally{await pool.end();}
});
