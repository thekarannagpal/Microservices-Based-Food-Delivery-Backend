/**
 * End-to-end demo against `docker compose up -d`.
 * Usage: npm run smoke  (BASE_URL / API_KEY can be overridden via env)
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:8000/api';
const API_KEY = process.env.API_KEY ?? 'demo-key-user';
const HEADERS = { 'content-type': 'application/json', apikey: API_KEY };

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return { data, traceId: response.headers.get('x-trace-id') };
}

async function poll(path, predicate, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const { data } = await call('GET', path);
    if (predicate(data)) return data;
    last = data;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for ${label}; last state: ${JSON.stringify(last)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  console.log(`Nexvia smoke test -> ${BASE}`);

  const seeded = await call('POST', '/restaurants/seed');
  console.log('seed:', seeded.data);

  const { data: restaurants } = await call('GET', '/restaurants');
  assert(restaurants.length > 0, 'at least one restaurant exists');
  const { data: menu } = await call('GET', `/restaurants/${restaurants[0].id}/menu`);
  assert(menu.length > 0, 'restaurant has menu items');
  const item = menu[0];
  const restaurantId = restaurants[0].id;

  const email = `demo-${Date.now()}@nexvia.test`;
  const { data: user } = await call('POST', '/users/register', {
    email,
    name: 'Demo Customer',
    password: 'password123',
  });
  console.log('registered user:', user.id);

  // Happy path: order -> payment -> stock -> delivery.
  const placed = await call('POST', '/orders', {
    customerId: user.id,
    restaurantId,
    items: [{ menuItemId: item.id, quantity: 1 }],
  });
  console.log('happy-path trace id:', placed.traceId);
  const order = await poll(`/orders/${placed.data.id}`, (o) => o.status !== 'PENDING_PAYMENT', 'order confirmation');
  assert(order.status === 'CONFIRMED', `order should be CONFIRMED, got ${order.status}`);

  const delivery = await poll(`/delivery/order/${order.id}`, (d) => d.status === 'ASSIGNED', 'courier assignment');
  console.log('delivery:', delivery.status, delivery.courierName, `${delivery.etaMinutes} min`);

  const notifications = (await call('GET', `/notifications?orderId=${order.id}`)).data;
  assert(notifications.some((n) => n.type === 'order.confirmed'), 'order.confirmed notification exists');
  assert(notifications.some((n) => n.type === 'delivery.assigned'), 'delivery.assigned notification exists');

  // Payment failure path: compensating order cancellation.
  const failed = await call('POST', '/orders', {
    customerId: 'fail-customer',
    restaurantId,
    items: [{ menuItemId: item.id, quantity: 1 }],
  });
  const failedOrder = await poll(`/orders/${failed.data.id}`, (o) => o.status !== 'PENDING_PAYMENT', 'payment failure');
  assert(failedOrder.status === 'CANCELLED', `failed payment should cancel the order, got ${failedOrder.status}`);
  const failedPayment = (await call('GET', `/payments/order/${failedOrder.id}`)).data;
  assert(failedPayment.status === 'FAILED', `payment should be FAILED, got ${failedPayment.status}`);
  console.log('payment-failure saga:', failedOrder.status, failedPayment.status, failedOrder.reason);

  // Stock failure path: payment is refunded when stock cannot be reserved.
  const noStock = await call('POST', '/orders', {
    customerId: user.id,
    restaurantId,
    items: [{ menuItemId: item.id, quantity: 9999 }],
  });
  const cancelledOrder = await poll(`/orders/${noStock.data.id}`, (o) => o.status !== 'PENDING_PAYMENT', 'stock failure');
  assert(cancelledOrder.status === 'CANCELLED', `stock failure should cancel the order, got ${cancelledOrder.status}`);
  const refunded = await poll(`/payments/order/${cancelledOrder.id}`, (p) => p.status === 'REFUNDED', 'compensating refund');
  console.log('stock-failure saga:', cancelledOrder.status, refunded.status, cancelledOrder.reason);

  console.log('\nAll smoke checks passed.');
  console.log('Open http://localhost:16686 and search the trace id above to see the request cross services.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
