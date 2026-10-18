import nextEnv from '@next/env';
import { parseArgs } from 'node:util';
import { assertIsolatedRecoveryTargets, createPool, evaluateRecovery, readOnly, recoverySnapshot, safeError, validateRecoveryInput } from './lib/tiger-ops.mjs';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} });
const pools = [];
try {
  const { values } = parseArgs({ options: { 'run-id': { type: 'string' }, 'target-time': { type: 'string' } } });
  const targetTime = validateRecoveryInput(values['run-id'], values['target-time']);
  assertIsolatedRecoveryTargets(process.env.DATABASE_URL, process.env.TIGER_DRILL_DATABASE_URL, process.env.TIGER_RECOVERY_DATABASE_URL);
  pools.push(createPool(process.env.TIGER_DRILL_DATABASE_URL), createPool(process.env.TIGER_RECOVERY_DATABASE_URL));
  // Never connect to the protected DATABASE_URL in a recovery drill.
  const [source, fork] = await Promise.all(pools.map(pool => readOnly(pool, client => recoverySnapshot(client, values['run-id']))));
  const result = evaluateRecovery(source, fork, targetTime);
  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), runId: values['run-id'], ...result, source, fork }, null, 2));
  process.exitCode = result.status === 'pass' ? 0 : 1;
} catch (error) {
  // Configuration errors are fixed text; never print database/driver exception messages.
  console.log(JSON.stringify({ status: 'fail', errorCode: safeError(error), help: 'See docs/operations/TIGER_DATA.md for isolated targets and required arguments.' }));
  process.exitCode = 1;
} finally { await Promise.all(pools.map(pool => pool.end())); }
