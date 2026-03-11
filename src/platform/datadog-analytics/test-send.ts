/**
 * Test: sends one custom + one funnel event.
 * Run from venus-three: npm run test:datadog  (or: npx tsx src/platform/datadog-analytics/test-send.ts)
 *
 * To verify in Databricks, run:
 *
 *   SELECT * FROM `venus-dev`.events.raw_events
 *   WHERE get_json_object(raw_json, '$.event_type') = 'datadog_analytics_test'
 *      OR get_json_object(raw_json, '$.event_type') = 'step_funnel'
 *   ORDER BY createdAt DESC LIMIT 20;
 */

import { init, trackCustom, trackFunnel } from './index';

init({
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://otel.run.game',
  serviceName: 'datadog-analytics-test',
  serviceVersion: '1.0.0',
  platform: 'web',
});

const MARKER = 'datadog_analytics_test';

async function main() {
  console.log('Sending test events (search for "%s" or service "datadog-analytics-test")...\n', MARKER);

  const ok1 = await trackCustom({
    name: MARKER,
    screen: 'test_script',
    desc: 'Test from datadog-analytics/test-send.ts',
    test_run_at: new Date().toISOString(),
  });
  console.log('trackCustom:', ok1 ? 'OK' : 'FAIL');

  const ok2 = await trackFunnel({
    step: `${MARKER}_funnel`,
    screenName: 'test_script',
    stepNumber: 0,
    funnelName: 'datadog_test_funnel',
    test_run_at: new Date().toISOString(),
  });
  console.log('trackFunnel:', ok2 ? 'OK' : 'FAIL');

  console.log('\nDatabricks: run the query in the file header to verify (event_type = "%s" or step_funnel)', MARKER);
}

main().catch(console.error);
