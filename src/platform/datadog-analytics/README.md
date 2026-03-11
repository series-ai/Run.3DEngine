# datadog-analytics

Minimal analytics client: `DatadogAnalytics.init()` once, then `DatadogAnalytics.trackCustom()` / `DatadogAnalytics.trackFunnel()`. Sends to collector → Databricks. **No external dependencies** (uses native `fetch`).

## Install / use in another project

1. **Copy** the `datadog-analytics` folder into your project (e.g. `src/datadog-analytics/` or project root).
2. **No npm install** — the module has zero dependencies (only uses native `fetch`). Your project must support TypeScript (or rename `.ts` → `.js` and strip types).
3. **Import** the API object: `import { DatadogAnalytics } from './datadog-analytics'`. Type `DatadogAnalytics.` to see all methods.
4. **Call `DatadogAnalytics.init()` once** at app startup with service name/version/platform. Endpoint is fixed in the module (`https://otel.run.game`). Then use `DatadogAnalytics.trackCustom()` and `DatadogAnalytics.trackFunnel()`.
5. **Optional:** Run the test script: from `venus-three`, `npm run test:datadog`.

## API

- **DatadogAnalytics.init({ serviceName?, serviceVersion?, platform? })** — call once. Endpoint is set in the module. Options identify the app and platform (ios/android/web).
- **DatadogAnalytics.trackCustom({ name, screen?, desc?, ...data })** — custom event. `name` = event_type; optional `screen`, `desc`; any extra keys as attributes.
- **DatadogAnalytics.trackFunnel({ step, screenName, stepNumber?, funnelName?, ...context })** — funnel step. Same shape as run-studio; lands in Databricks.

## Example

```ts
import { DatadogAnalytics } from './datadog-analytics';

DatadogAnalytics.init({ serviceName: 'my-app', serviceVersion: '1.0.0', platform: 'web' });

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

**Databricks:** Table `venus-dev`.events.raw_events, column `raw_json`. Filter by `event_type` (e.g. `datadog_analytics_test` or `step_funnel`). Each event also includes `service_name` and `service_version` in the payload so you can filter gameplay (`service_name = 'burgertime-capacitor'`) from test (`service_name = 'datadog-analytics-test'`).

## Android build and verifying Android events

From repo root:

- **Build and sync to Android:** `npm run build:all:android` (builds engine + demos capacitor + cap sync).
- **Build debug APK:** `npm run build:android:apk` (build:all:android + Gradle assembleDebug).
- **Open Android Studio:** `npm run open:android`.

**CORS / native HTTP:** The demos app enables `CapacitorHttp` in `capacitor.config.ts` so `fetch()` uses the native HTTP client on Android/iOS and bypasses WebView CORS. Rebuild and sync after changing that config.

**Check APK logs (device connected via USB):**
```bash
adb logcat | grep -E "DatadogAnalytics|Capacitor/Console|Capacitor.*otel"
```
Look for `[DatadogAnalytics] send failed` or `send error` if events aren’t reaching the server.

To verify analytics on Android: install and run the app on a device/emulator, play the game, then in Databricks run:

```sql
SELECT *
FROM `venus-dev`.events.raw_events
WHERE get_json_object(raw_json, '$.service_name') = 'burgertime-capacitor'
  AND get_json_object(raw_json, '$.platform') = 'android'
ORDER BY get_json_object(raw_json, '$.timestamp') DESC
LIMIT 50;
```
