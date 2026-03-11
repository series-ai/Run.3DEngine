/**
 * Minimal analytics client. Call DatadogAnalytics.init() once, then DatadogAnalytics.trackCustom() or DatadogAnalytics.trackFunnel(). Sends to collector → Databricks.
 */

const OTEL_ENDPOINT = 'https://otel.run.game';
const LOGS_PATH = '/v1/logs';

type OtlpValue =
  | { stringValue: string }
  | { intValue: string }
  | { boolValue: boolean }
  | { doubleValue: number };

function toOtlpValue(v: unknown): OtlpValue {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { boolValue: v };
  return { stringValue: String(v) };
}

function toOtlpAttributes(data: Record<string, unknown>): { key: string; value: OtlpValue }[] {
  return Object.entries(data).map(([key, value]) => ({ key, value: toOtlpValue(value) }));
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

let config = {
  endpoint: OTEL_ENDPOINT.replace(/\/$/, ''),
  serviceName: 'unknown',
  serviceVersion: '0.0.0',
  platform: 'web' as 'ios' | 'android' | 'web',
  sessionId: '',
};

function init(options?: { serviceName?: string; serviceVersion?: string; platform?: 'ios' | 'android' | 'web' }): void {
  config.sessionId = generateSessionId();
  if (options) {
    if (options.serviceName !== undefined) config.serviceName = options.serviceName;
    if (options.serviceVersion !== undefined) config.serviceVersion = options.serviceVersion;
    if (options.platform !== undefined) config.platform = options.platform;
  }
}

function getEndpoint(): string {
  // Native (android/ios): always use real endpoint; device has no proxy.
  if (config.platform === 'android' || config.platform === 'ios') {
    return config.endpoint
  }
  // Web on localhost: use Vite proxy so same-origin (no CORS). Requires demos dev server with /api/otel proxy.
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname ?? ''
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}/api/otel`
    }
  }
  return config.endpoint
}

function send(attributes: Record<string, unknown>, body: string): Promise<boolean> {
  const payload = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: config.serviceName } },
            { key: 'service.version', value: { stringValue: config.serviceVersion } },
            { key: 'log.type', value: { stringValue: 'hermes' } },
          ],
        },
        scopeLogs: [
          {
            scope: { name: 'datadog-analytics', version: '1.0.0' },
            logRecords: [
              {
                timeUnixNano: String(Date.now() * 1e6),
                severityText: 'INFO',
                severityNumber: 9,
                body: { stringValue: body },
                attributes: toOtlpAttributes({
                  timestamp: Date.now(),
                  platform: config.platform,
                  service_name: config.serviceName,
                  session_id: config.sessionId,
                  ...attributes,
                }),
              },
            ],
          },
        ],
      },
    ],
  };
  const url = `${getEndpoint()}${LOGS_PATH}`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok && typeof console !== 'undefined' && console.warn) {
        console.warn('[DatadogAnalytics] send failed:', res.status, url)
      }
      return res.ok
    })
    .catch((err) => {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DatadogAnalytics] send error:', err)
      }
      return false
    })
}

function trackCustom(params: { name: string; screen?: string; desc?: string; [key: string]: unknown }): Promise<boolean> {
  const { name, screen, desc, ...rest } = params;
  return send(
    { event_type: name, screen_name: screen ?? '', ...(desc !== undefined && { description: desc }), ...rest },
    name
  );
}

function trackFunnel(params: {
  step: string;
  screenName: string;
  stepNumber?: number;
  funnelName?: string;
  [key: string]: unknown;
}): Promise<boolean> {
  const { step, screenName, stepNumber = 0, funnelName = 'studio_funnel', ...context } = params;
  return send(
    { event_type: 'step_funnel', screen_name: screenName, funnel_name: funnelName, step_name: step, step_number: stepNumber, ...context },
    `step_funnel:${step}`
  );
}

/** Datadog analytics API: init once, then trackCustom / trackFunnel. Type DatadogAnalytics. to see all methods. */
export const DatadogAnalytics = {
  init,
  trackCustom,
  trackFunnel,
};
