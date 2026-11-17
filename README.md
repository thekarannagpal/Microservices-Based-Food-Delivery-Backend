# Nexvia — Event-Driven Food Delivery Backend

A microservices backend for food ordering. Six NestJS services own their own MongoDB databases, cooperate through RabbitMQ events, use gRPC for the fast pricing call, sit behind Kong, and report traces to Jaeger.

## Stack

| Concern | Choice |
| --- | --- |
| Services | NestJS 12 (TypeScript) |
| Databases | MongoDB — one database per service |
| Messaging | RabbitMQ topic exchange `nexvia.events` |
| Sync service call | gRPC `PricingService.CalculateQuote` |
| Gateway | Kong 3.x (DB-less declarative config) |
| Tracing | W3C `traceparent` propagation → Jaeger Zipkin collector |
| Runtime | Docker Compose |

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries and saga diagrams, and [API.md](API.md) for the full HTTP/event/gRPC reference.

## Quick start

Prerequisites: Docker Desktop (or Docker Engine + Compose v2). Node 20+ is only needed to run the unit tests/smoke script outside a container.

```bash
cd D:\Nexvia
npm install
npm run build        # compile shared lib + all services
npm test             # 9 unit tests (saga + trace propagation)

docker compose up -d --build
docker compose ps    # wait until mongodb and rabbitmq are healthy
npm run smoke        # end-to-end demo through Kong
```

`npm run smoke` registers a user, seeds restaurants, places a successful order, drives a payment failure, drives a stock failure with compensating refund, and prints a trace id to look up in Jaeger.

### Local URLs

| UI / endpoint | URL | Notes |
| --- | --- | --- |
| API via Kong | http://localhost:8000/api | All requests need `apikey` header |
| Kong Admin | http://localhost:8001 | Declarative config loaded from `infra/kong/kong.yaml` |
| Jaeger UI | http://localhost:16686 | Search the trace id printed by the smoke test |
| RabbitMQ UI | http://localhost:15672 | `guest` / `guest` |
| MongoDB | localhost:27017 | Six databases, one per service |
| gRPC pricing | localhost:50051 | `pricing.PricingService` |

Direct service ports (for debugging): users 3001, restaurants 3002, orders 3003, payments 3004, delivery 3005, notifications 3006.

## Gateway auth and rate limiting

Kong uses `key-auth`. Send one of the demo keys on every request:

```bash
curl -H 'apikey: demo-key-user' http://localhost:8000/api/restaurants
```

- `demo-key-user` → consumer `demo-user`
- `demo-key-admin` → consumer `demo-admin`

Rate limits (local policy, per consumer): 100 requests/minute for most services, 30 requests/minute for orders. Exceeding them returns `429`. Change these in `infra/kong/kong.yaml`.

## Services and ownership

| Service | Owns | Publishes | Consumes |
| --- | --- | --- | --- |
| users | `nexvia_users` | — | — |
| restaurants | `nexvia_restaurants` | `stock.reserved`, `stock.reservation.failed` | `order.placed` (reserve stock) + hosts gRPC pricing |
| orders | `nexvia_orders` | `order.placed`, `order.confirmed`, `order.cancelled`, `payment.refund.requested` | `payment.completed`, `payment.failed`, `stock.reservation.failed`, `delivery.assigned` |
| payments | `nexvia_payments` | `payment.completed`, `payment.failed`, `payment.refunded` | `order.placed`, `payment.refund.requested` |
| delivery | `nexvia_delivery` | `delivery.requested`, `delivery.assigned`, `delivery.status.updated` | `order.confirmed` |
| notifications | `nexvia_notifications` | — | all business events (in-app log) |

## Demo scenarios

1. **Happy path** — `POST /orders` → price via gRPC → `order.placed` → payment completes and stock is reserved → `order.confirmed` → delivery requested and courier assigned.
2. **Payment failure** — use `"customerId": "fail-customer"` (or a total above `PAYMENT_MAX_AMOUNT`). The order is cancelled and restaurants release the reserved stock via `order.cancelled`.
3. **Stock failure** — request a quantity larger than available (e.g. `9999`). The order is cancelled; if payment had already completed, `payment.refund.requested` triggers a refund.
4. **Manual cancellation** — `POST /orders/:id/cancel` cancels and requests a refund when appropriate.

Payment rules are configured with `PAYMENT_FAIL_CUSTOMERS`, `PAYMENT_MAX_AMOUNT`, and `PAYMENT_FAILURE_RATE`.

## Distributed tracing

The HTTP middleware reads/creates a W3C `traceparent`, returns `x-trace-id` in the response, and starts a SERVER span. The id is propagated:

- HTTP → RabbitMQ: AMQP `traceparent` header
- RabbitMQ → RabbitMQ: same header on every published event
- Orders → Restaurants: `traceparent` field in the gRPC request
- Every span is sent to Jaeger's Zipkin endpoint and logged as JSON to stdout.

After the smoke test, open Jaeger, pick the printed trace id, and you will see one trace spanning `orders`, `restaurants` (gRPC + stock), `payments`, `delivery`, and `notifications`.

## Local development without Docker

Start MongoDB, RabbitMQ, and Jaeger locally, then copy `.env.example` to `.env`, export the variables, and run services individually:

```bash
npm run build
PORT=3002 SERVICE_NAME=restaurants node services/restaurants/dist/main.js
PORT=3003 SERVICE_NAME=orders node services/orders/dist/main.js
```

Defaults assume `mongodb://localhost:27017`, `amqp://guest:guest@localhost:5672`, `http://localhost:9411`, and gRPC on `localhost:50051`.

## Test results and limitations

See [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md). The build and 9 unit tests pass; the Docker-based smoke test is provided but could not be executed in the environment where this repository was generated because Docker is not installed there.

Known simplifications (intentional for a demo):

- One MongoDB container hosts six logically separate databases. In production, give each service its own cluster/credentials.
- The payment gateway and courier assignment are simulated; no third-party credentials are required.
- The tracer is a small Zipkin-compatible implementation rather than the full OpenTelemetry SDK.
- Kong key-auth uses static demo consumers; production should issue/revoke keys through an identity provider.

## Cleanup

```bash
docker compose down -v
```

## Repository layout

```
libs/shared/          events, saga transitions, Rabbit client, tracing, gRPC types
services/*/           six NestJS services, each with its own schema and DB name
proto/pricing.proto   gRPC contract
infra/kong/           gateway routes, auth, rate limits
docker/Dockerfile     shared multi-stage build (ARG SERVICE)
scripts/smoke.mjs     end-to-end demo
docs/                 API, architecture, test results
```
