import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connectionIdentity } from './tiger-ops.mjs';
const run = promisify(execFile);
export async function tigerJson(args) {
  const { stdout } = await run('tiger', ['--version-check=false', '--analytics=false', '--color=false', ...args, '--output', 'json'], { timeout: 25000, maxBuffer: 4000000 });
  return JSON.parse(stdout);
}
export function selectService(services, connectionString) {
  const host = connectionIdentity(connectionString);
  const matches = services.filter(service => (service.endpoint?.host || service.host || '').toLowerCase().replace(/\.$/, '') === host);
  if (matches.length !== 1) throw new Error('Exactly one service must match the configured database host');
  return matches[0];
}
export function summarizeSeries(series) {
  const points = series.flatMap(entry => entry.data ?? []).filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.time))).sort((a,b) => Date.parse(a.time) - Date.parse(b.time));
  if (!points.length) return { status: 'unavailable', samples: 0 };
  return { status: 'available', samples: points.length, average: points.reduce((sum,point) => sum + point.value, 0) / points.length, maximum: Math.max(...points.map(point => point.value)), latest: points.at(-1).value, latestTime: points.at(-1).time };
}
export async function collectCloudMetrics(connectionString, execute = tigerJson, now = new Date()) {
  const services = await execute(['service', 'list']);
  const service = selectService(services, connectionString);
  const available = await execute(['service', 'metrics', 'available', service.service_id]);
  const names = ['timescale_cloud_system_cpu_total_millicores','timescale_cloud_system_cpu_usage_millicores','timescale_cloud_system_memory_total_bytes','timescale_cloud_system_memory_usage_bytes','timescale_cloud_system_disk_usage_bytes'];
  const from = new Date(now.getTime() - 15 * 60000).toISOString();
  const to = now.toISOString();
  const metrics = Object.fromEntries(await Promise.all(names.map(async name => {
    if (!available.includes(name)) return [name, { status: 'unavailable', samples: 0 }];
    try {
      const series = await execute(['service', 'metrics', 'series', service.service_id, '--metric', name, '--from', from, '--to', to, '--bucket-seconds', '60', '--role', 'PRIMARY']);
      return [name, summarizeSeries(series)];
    } catch { return [name, { status: 'unavailable', samples: 0 }]; }
  })));
  const status = Object.values(metrics).every(metric => metric.status === 'available') ? 'ok' : 'partial';
  return { capturedAt: to, authenticatedServiceRead: true, serviceReady: service.status === 'READY', from, to, bucketSeconds: 60, metrics, status,
    backupCoverageVerified: false, recurringMonitoringInstalled: false, alertRoutingVerified: false,
    note: 'Ad hoc primary-service metric samples only. No exporter or alerts were installed; backup history, retention and PITR still require separate verification.' };
}
