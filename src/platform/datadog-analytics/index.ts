/**
 * Minimal analytics client. init() once, then trackCustom() or trackFunnel(). Sends to collector → Databricks.
 */

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

let config = {
  endpoint: '',
  serviceName: 'unknown',
  serviceVersion: '0.0.0',
  platform: 'web' as 'ios' | 'android' | 'web',
};

export function init(options: {
  endpoint: string;
  serviceName?: string;
  serviceVersion?: string;
  platform?: 'ios' | 'android' | 'web';
}): void {
  config = {
    endpoint: options.endpoint.replace(/\/$/, ''),
    serviceName: options.serviceName ?? 'unknown',
    serviceVersion: options.serviceVersion ?? '0.0.0',
    platform: options.platform ?? 'web',
  };
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
                attributes: toOtlpAttributes({ timestamp: Date.now(), platform: config.platform, ...attributes }),
              },
            ],
          },
        ],
      },
    ],
  };
  return fetch(`${config.endpoint}${LOGS_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

export function trackCustom(params: { name: string; screen?: string; desc?: string; [key: string]: unknown }): Promise<boolean> {
  const { name, screen, desc, ...rest } = params;
  return send(
    { event_type: name, screen_name: screen ?? '', ...(desc !== undefined && { description: desc }), ...rest },
    name
  );
}

export function trackFunnel(params: {
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
