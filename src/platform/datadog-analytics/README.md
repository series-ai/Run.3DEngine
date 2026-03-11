# datadog-analytics

Minimal analytics client: `DatadogAnalytics.init()` once, then `DatadogAnalytics.trackCustom()` / `DatadogAnalytics.trackFunnel()`. Sends to collector → Databricks. **No external dependencies** (uses native `fetch`).

## Install / use in another project

1. **Copy** the `datadog-analytics` folder into your project (e.g. `src/datadog-analytics/` or project root).
2. **No npm install** — the module has zero dependencies (only uses native `fetch`). Your project must support TypeScript (or rename `.ts` → `.js` and strip types).
3. **Import** the API object: `import { DatadogAnalytics } from './datadog-analytics'`. Type `DatadogAnalytics.` to see all methods.
4. **Call `DatadogAnalytics.init()` once** at app startup with the collector endpoint. Then use `DatadogAnalytics.trackCustom()` and `DatadogAnalytics.trackFunnel()` wherever you need to send events.
5. **Optional:** Run the test script: from `venus-three`, `npm run test:datadog`. Set `OTEL_EXPORTER_OTLP_ENDPOINT` if your endpoint differs.

## API

- **DatadogAnalytics.init({ endpoint, serviceName?, serviceVersion?, platform? })** — call once. `endpoint` e.g. `'https://otel.run.game'`.
- **DatadogAnalytics.trackCustom({ name, screen?, desc?, ...data })** — custom event. `name` = event_type; optional `screen`, `desc`; any extra keys as attributes.
- **DatadogAnalytics.trackFunnel({ step, screenName, stepNumber?, funnelName?, ...context })** — funnel step. Same shape as run-studio; lands in Databricks.

## Example

```ts
import { DatadogAnalytics } from './datadog-analytics';

DatadogAnalytics.init({ endpoint: 'https://otel.run.game', serviceName: 'my-app' });

await DatadogAnalytics.trackCustom({ name: 'level_complete', screen: 'game', level: 3 });
await DatadogAnalytics.trackFunnel({ step: 'checkout_start', screenName: 'checkout', stepNumber: 1 });
```

## Test

From repo root (monorepo):

```bash
cd venus-three && npx tsx src/platform/datadog-analytics/test-send.ts
```

Or with env:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.run.game npx tsx venus-three/src/platform/datadog-analytics/test-send.ts
```

**Databricks:** Table `venus-dev`.events.raw_events, column `raw_json`. Filter by `event_type = 'datadog_analytics_test'` or `service_name = 'datadog-analytics-test'`.
