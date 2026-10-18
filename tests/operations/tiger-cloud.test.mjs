import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCloudMetrics, selectService, summarizeSeries } from '../../scripts/lib/tiger-cloud.mjs';
test('selects exactly the configured service and never uses an arbitrary default', () => {
  const services=[{host:'first.example',service_id:'one'},{endpoint:{host:'target.example'},service_id:'two'}];
  assert.equal(selectService(services,'postgres://private:secret@target.example/tsdb').service_id,'two');
  assert.throws(()=>selectService(services,'postgres://user@missing.example/tsdb'));
  assert.throws(()=>selectService([...services,services[1]],'postgres://user@target.example/tsdb'));
});
test('summarizes numeric samples without exposing provider labels or raw records', () => {
  const report=summarizeSeries([{labels:{private:'not-for-output'},data:[{time:'2026-10-18T10:00:00Z',value:4},{time:'2026-10-18T09:00:00Z',value:2},{time:'invalid',value:8}]}]);
  assert.equal(report.average,3);assert.equal(report.latest,4);assert.equal(report.samples,2);
  assert.equal(JSON.stringify(report).includes('not-for-output'),false);
});
test('missing or failed metrics do not masquerade as healthy installed monitoring', async () => {
  const report=await collectCloudMetrics('postgres://user:secret@target.example/tsdb',async args=>{
    if(args[0]==='service'&&args[1]==='list')return[{host:'target.example',service_id:'private-id',status:'READY',connection_string:'private-connection'}];
    if(args.includes('available'))return ['timescale_cloud_system_cpu_usage_millicores'];
    throw new Error('provider-token-never-print');
  });
  assert.equal(report.status,'partial');assert.equal(report.backupCoverageVerified,false);assert.equal(report.alertRoutingVerified,false);
  assert.doesNotMatch(JSON.stringify(report),/secret|private-id|private-connection|provider-token/);
});
