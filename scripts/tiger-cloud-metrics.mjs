import nextEnv from '@next/env';
import { collectCloudMetrics } from './lib/tiger-cloud.mjs';
import { safeError } from './lib/tiger-ops.mjs';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} });
try {
  const report = await collectCloudMetrics(process.env.DATABASE_URL);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.serviceReady && report.status === 'ok' ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ status: 'fail', errorCode: safeError(error), help: 'Install Tiger CLI and run tiger auth login in this workspace; no credentials are printed.' }));
  process.exitCode = 1;
}
