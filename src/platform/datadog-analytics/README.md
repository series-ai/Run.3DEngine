# datadog-analytics

Minimal analytics client: `init` + `trackCustom` / `trackFunnel`. Sends to collector → Databricks. **No external dependencies** (uses native `fetch`).

## Install / use in another project

1. **Copy** the `datadog-analytics` folder into your project (e.g. `src/datadog-analytics/` or project root).
2. **No npm install** — the module has zero dependencies (only uses native `fetch`). Your project must support TypeScript (or rename `.ts` → `.js` and strip types).
3. **Import** from wherever you placed it, e.g. `import { init, trackCustom, trackFunnel } from './datadog-analytics'` or `from '@/lib/datadog-analytics'`.
4. **Call `init()` once** at app startup with the collector endpoint (e.g. from env: `process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://otel.run.game'`). Then use `trackCustom()` and `trackFunnel()` wherever you need to send events.
5. **Optional:** Run the test script to confirm events reach Databricks: from the folder that contains `datadog-analytics`, run `pnpm tsx datadog-analytics/test-send.ts` (or `npx tsx datadog-analytics/test-send.ts`). Set `OTEL_EXPORTER_OTLP_ENDPOINT` if your endpoint differs.

## API

- **init({ endpoint, serviceName?, serviceVersion?, platform? })** — call once. `endpoint` e.g. `'https://otel.run.game'`.
- **trackCustom({ name, screen?, desc?, ...data })** — custom event. `name` = event_type; optional `screen`, `desc`; any extra keys as attributes.
- **trackFunnel({ step, screenName, stepNumber?, funnelName?, ...context })** — funnel step. Same shape as run-studio; lands in Databricks.

## Example

```ts
import { init, trackCustom, trackFunnel } from './datadog-analytics';

init({ endpoint: 'https://otel.run.game', serviceName: 'my-app' });

await trackCustom({ name: 'level_complete', screen: 'game', level: 3 });
await trackFunnel({ step: 'checkout_start', screenName: 'checkout', stepNumber: 1 });
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
