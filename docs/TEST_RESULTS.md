# Test results

Environment used to generate this repository: Windows, Node v26.13.1, npm 11.20.0. Docker CLI was **not available**, so container startup and the HTTP smoke test could not be executed here; commands and expected results are documented below for a Docker-enabled machine.

## Executed successfully

### 1. Compile all projects

```text
> npm run build
> tsc -b tsconfig.json

(no errors)
```

Builds `@nexvia/shared` plus all six NestJS services.

### 2. Unit tests

```text
> npm test
> tsx --test libs/shared/test/saga.test.ts libs/shared/test/tracing.test.ts

✔ successful payment confirms a pending order
✔ failed payment cancels a pending order
✔ late payment on a cancelled order requests a refund instead of confirming
✔ duplicate payment events are ignored
✔ stock failure cancels pending orders and compensates a completed payment
✔ manual cancellation is only allowed before delivery
✔ traceparent round-trips through W3C headers
✔ child spans keep the trace id and point at the parent span
✔ malformed headers start a fresh valid trace

tests 9 | pass 9 | fail 0
```

Coverage: saga state transitions, compensation rules, idempotency behavior, and W3C trace-context propagation.

### 3. Module and proto loading

```text
> node -e "loadSync(proto/pricing.proto); require each dist/app.module.js"

proto OK: [ 'CalculateQuote' ]
module OK: users
module OK: restaurants
module OK: orders
module OK: payments
module OK: delivery
module OK: notifications
```

### 4. Infrastructure config parsing

```text
> npx js-yaml docker-compose.yml
> npx js-yaml infra/kong/kong.yaml

both files parsed successfully
```

## To run on a Docker-enabled machine

```bash
npm install
npm run build
npm test
docker compose up -d --build
docker compose ps
npm run smoke
```

Expected smoke output:

- sample catalog seeded
- demo user registered
- happy-path order reaches `CONFIRMED`, delivery reaches `ASSIGNED`
- `order.confirmed` and `delivery.assigned` notifications exist
- `fail-customer` order reaches `CANCELLED` with payment `FAILED`
- over-stock order reaches `CANCELLED` and payment reaches `REFUNDED`
- `All smoke checks passed.` plus a trace id to search in Jaeger (`http://localhost:16686`)

Gateway checks:

```bash
curl -i http://localhost:8000/api/restaurants
# 401 Unauthorized (missing apikey)

curl -i -H 'apikey: demo-key-user' http://localhost:8000/api/restaurants
# 200 OK with x-trace-id header
```

## Known untested edge cases

- Kong plugin behavior depends on the exact image tag pulled at deploy time; verify `GET /api/restaurants` with and without `apikey`.
- Jaeger 1.62 accepts Zipkin spans at `:9411`; if using a different Jaeger distribution, enable the Zipkin collector or swap in an OTLP exporter.
- RabbitMQ connection retry and saga redelivery behavior are implemented but only observable with the full Compose stack running.
