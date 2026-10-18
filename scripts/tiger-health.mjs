import nextEnv from '@next/env';
import { collectHealth, createPool, readOnly, safeError } from './lib/tiger-ops.mjs';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} });
let pool;
try {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  pool = createPool(process.env.DATABASE_URL);
  const report = await readOnly(pool, collectHealth);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'fail' ? 1 : 0;
} catch (error) {
  console.log(JSON.stringify({ status: 'fail', errorCode: safeError(error) }));
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
