import assert from 'node:assert/strict';
import test from 'node:test';
import { childContext, contextFromCarrier, formatTraceparent, parseTraceparent } from '../src/tracing';

test('traceparent round-trips through W3C headers', () => {
  const context = contextFromCarrier({ traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' });
  assert.equal(context.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
  assert.equal(context.spanId, '00f067aa0ba902b7');
  assert.equal(parseTraceparent(formatTraceparent(context))?.spanId, context.spanId);
});

test('child spans keep the trace id and point at the parent span', () => {
  const parent = contextFromCarrier({ 'x-trace-id': 'a'.repeat(32), 'x-span-id': 'b'.repeat(16) });
  const child = childContext(parent);
  assert.equal(child.traceId, parent.traceId);
  assert.equal(child.parentSpanId, parent.spanId);
  assert.notEqual(child.spanId, parent.spanId);
});

test('malformed headers start a fresh valid trace', () => {
  const context = contextFromCarrier({ traceparent: 'garbage', 'x-trace-id': 'nope' });
  assert.match(context.traceId, /^[0-9a-f]{32}$/);
  assert.match(context.spanId, /^[0-9a-f]{16}$/);
});
