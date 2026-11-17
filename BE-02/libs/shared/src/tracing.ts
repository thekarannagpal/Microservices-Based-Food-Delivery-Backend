/**
 * Small W3C Trace Context implementation with a Zipkin-compatible exporter.
 * Jaeger's all-in-one image exposes a Zipkin collector on :9411, so no extra
 * OpenTelemetry dependency is needed for the demo. Swap this module for the
 * OTel SDK in production without changing the call sites.
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export type Carrier = Record<string, string | string[] | undefined> | undefined;

const randomHex = (bytes: number): string => {
  const out: string[] = [];
  for (let i = 0; i < bytes; i++) out.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  return out.join('');
};

export const newTraceId = (): string => randomHex(16);
export const newSpanId = (): string => randomHex(8);

const header = (carrier: Carrier, name: string): string | undefined => {
  if (!carrier) return undefined;
  const value = carrier[name] ?? carrier[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export function parseTraceparent(value?: string): TraceContext | undefined {
  if (!value) return undefined;
  const parts = value.trim().split('-');
  if (parts.length < 4) return undefined;
  const [, traceId, spanId] = parts;
  if (!/^[0-9a-f]{32}$/i.test(traceId) || !/^[0-9a-f]{16}$/i.test(spanId)) return undefined;
  return { traceId: traceId.toLowerCase(), spanId: spanId.toLowerCase() };
}

export function formatTraceparent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-01`;
}

/** Read trace state from HTTP headers, AMQP properties, or a gRPC message field. */
export function contextFromCarrier(carrier: Carrier): TraceContext {
  const fromTraceparent = parseTraceparent(header(carrier, 'traceparent'));
  if (fromTraceparent) return fromTraceparent;

  const traceId = header(carrier, 'x-trace-id');
  const spanId = header(carrier, 'x-span-id');
  if (traceId && /^[0-9a-f]{32}$/i.test(traceId)) {
    return {
      traceId: traceId.toLowerCase(),
      spanId: spanId && /^[0-9a-f]{16}$/i.test(spanId) ? spanId.toLowerCase() : newSpanId(),
    };
  }
  return { traceId: newTraceId(), spanId: newSpanId() };
}

export function childContext(parent?: TraceContext): TraceContext {
  return {
    traceId: parent?.traceId ?? newTraceId(),
    spanId: newSpanId(),
    parentSpanId: parent?.spanId,
  };
}

export interface Span {
  readonly context: TraceContext;
  finish(tags?: Record<string, string | number | boolean>): void;
}

const zipkinUrl = (): string => process.env.JAEGER_ZIPKIN_URL ?? 'http://localhost:9411';
const serviceName = (): string => process.env.SERVICE_NAME ?? 'nexvia-service';

export function startSpan(
  name: string,
  parent?: TraceContext,
  kind: 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER' = 'SERVER',
  serviceOverride?: string,
): Span {
  const context = childContext(parent);
  const startedAt = Date.now() * 1000;

  return {
    context,
    finish(tags = {}) {
      const duration = Math.max(1, Date.now() * 1000 - startedAt);
      const span = {
        traceId: context.traceId,
        id: context.spanId,
        ...(context.parentSpanId ? { parentId: context.parentSpanId } : {}),
        name,
        kind,
        timestamp: startedAt,
        duration,
        localEndpoint: { serviceName: serviceOverride ?? serviceName() },
        tags: Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, String(value)])),
      };

      if (process.env.TRACE_ENABLED !== 'false') {
        console.log(
          JSON.stringify({
            trace: context.traceId,
            span: context.spanId,
            parent: context.parentSpanId ?? null,
            service: serviceName(),
            name,
            durationMs: Math.round(duration / 1000),
          }),
        );
        void fetch(`${zipkinUrl()}/api/v2/spans`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify([span]),
        }).catch(() => undefined);
      }
    },
  };
}

/**
 * Express middleware: continues an incoming trace or starts one, exposes the
 * ids on the response, and emits a SERVER span when the response finishes.
 */
export function tracingMiddleware(service: string) {
  return (req: any, res: any, next: () => void) => {
    const parent = contextFromCarrier(req.headers);
    const span = startSpan(`HTTP ${req.method} ${req.path}`, parent, 'SERVER', service);
    req.traceContext = span.context;
    res.setHeader('x-trace-id', span.context.traceId);
    res.setHeader('traceparent', formatTraceparent(span.context));

    res.on('finish', () => {
      span.finish({ 'http.method': req.method, 'http.route': req.path, 'http.status_code': res.statusCode });
    });
    next();
  };
}
