# API reference

## Conventions

- Gateway base URL: `http://localhost:8000/api`
- Every request requires `apikey: demo-key-user` (or `demo-key-admin`).
- JSON request/response bodies.
- Responses include `x-trace-id` and `traceparent` headers for demo tracing.
- Errors follow NestJS shape: `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.

Example:

```bash
curl -H 'apikey: demo-key-user' http://localhost:8000/api/restaurants
```

## Users (`/api/users`)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/register` | `{ "email", "name", "password" (min 8) }` | Created user (password hash omitted) |
| POST | `/login` | `{ "email", "password" }` | User profile or 401 |
| GET | `/` | — | All users |
| GET | `/:id` | — | User by id |

## Restaurants (`/api/restaurants`)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/seed` | — | Idempotent sample catalog (3 restaurants, 8 menu items) |
| GET | `/` | — | Restaurants |
| GET | `/:id` | — | Restaurant |
| POST | `/` | `{ "name", "cuisine", "address", "rating" }` | Created restaurant |
| GET | `/:id/menu` | — | Menu items with stock |
| POST | `/:id/menu` | `{ "name", "description", "price", "stock" }` | Created menu item |
| PATCH | `/menu/:id/stock` | `{ "stock": 10 }` | Updated menu item |

gRPC (port 50051): `pricing.PricingService/CalculateQuote`.

```text
QuoteRequest  { restaurantId, items: [{ menuItemId, quantity }], traceparent }
QuoteResponse { restaurantId, lines: [{ menuItemId, name, quantity, unitPrice, lineTotal }],
                subtotal, deliveryFee, tax, total, currency, error }
```

## Orders (`/api/orders`)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/` | `{ "customerId", "restaurantId", "items": [{ "menuItemId", "quantity" }] }` | Created order (`PENDING_PAYMENT`) |
| GET | `/` | query `?customerId=` | Orders, newest first |
| GET | `/:id` | — | Order with status, reason, courier details |
| POST | `/:id/cancel` | `{ "reason"? }` | Cancelled order; publishes cancellation + refund request |

```json
{
  "id": "65f0...",
  "status": "CONFIRMED",
  "totalAmount": 454,
  "items": [{ "menuItemId": "65e1...", "name": "Butter Chicken", "quantity": 1, "unitPrice": 320, "lineTotal": 320 }]
}
```

Status values: `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`.

## Payments (`/api/payments`)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/` | query `?orderId=` | Payments |
| GET | `/order/:orderId` | — | Payment for an order |
| GET | `/:id` | — | Payment by id |
| POST | `/:orderId/refund` | `{ "reason": "..." }` | Publishes a refund request |

Status values: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`.

Failure simulation defaults: customer id `fail-customer`, totals above `10000`, or `PAYMENT_FAILURE_RATE` probability.

## Delivery (`/api/delivery`)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/` | — | Deliveries |
| GET | `/order/:orderId` | — | Delivery for an order |
| GET | `/:id` | — | Delivery by id |
| PATCH | `/:id/status` | `{ "status": "PICKED_UP" }` | Next status + `delivery.status.updated` event |

Status values: `REQUESTED`, `ASSIGNED`, `PICKED_UP`, `DELIVERED`. Only forward transitions are allowed.

## Notifications (`/api/notifications`)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/` | query `?orderId=` | Notifications, newest first |
| GET | `/:id` | — | Notification by id |

Notification `type` is the routing key that produced it; `traceId` is the originating trace.

## Events

All events are JSON on the durable topic exchange `nexvia.events` and include:

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-11-17T10:00:00.000Z",
  "correlationId": "uuid",
  "traceparent": "00-<32hex>-<16hex>-01"
}
```

| Routing key | Additional fields |
| --- | --- |
| `order.placed` | `orderId`, `customerId`, `restaurantId`, `items[]`, `subtotal`, `deliveryFee`, `tax`, `totalAmount` |
| `stock.reserved` | `orderId`, `restaurantId` |
| `stock.reservation.failed` | `orderId`, `restaurantId`, `reason` |
| `payment.completed` | `orderId`, `paymentId`, `amount` |
| `payment.failed` | `orderId`, `paymentId`, `amount`, `reason` |
| `order.confirmed` | `orderId`, `customerId`, `restaurantId`, `totalAmount` |
| `order.cancelled` | `orderId`, `customerId`, `restaurantId`, `reason` |
| `payment.refund.requested` | `orderId`, `reason` |
| `payment.refunded` | `orderId`, `paymentId`, `amount`, `reason` |
| `delivery.requested` | `orderId`, `deliveryId`, `address` |
| `delivery.assigned` | `orderId`, `deliveryId`, `courierName`, `etaMinutes` |
| `delivery.status.updated` | `orderId`, `deliveryId`, `status` |

Queues: `restaurants.inventory`, `orders.saga`, `payments.commands`, `delivery.events`, `notifications.events`.
