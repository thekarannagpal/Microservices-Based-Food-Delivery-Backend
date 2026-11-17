# Test results — BE-03

Environment: Windows, Python 3.12.10, pytest 8.4.2, FastAPI 0.163.1, SQLAlchemy 2.0.x (pinned below 2.1 because the 2.1 C extension is blocked by the local Application Control policy).

## Executed successfully

```text
> .venv\Scripts\python.exe -m pytest -q

........                                                                 [100%]
8 passed, 1 warning in 0.43s
```

Tests use SQLite in-memory + fakeredis, so no PostgreSQL/Redis installation is needed.

### Covered

- health, developer portal, Prometheus metrics, OpenAPI paths
- API key creation, SHA-256 storage (raw key never listed), revocation, missing/invalid keys, admin guard
- Redis token bucket: three allowed calls then `429` with `Retry-After` and rate-limit headers
- metering: every call increments hourly counters and endpoint breakdown
- sample analyzer: positive / negative / neutral sentiment and keyword extraction
- billing: simulated Stripe checkout, demo webhook plan upgrade, replayed webhook idempotency
- Celery aggregation task writes an hourly summary into PostgreSQL-compatible ORM tables

## To run on a Docker-enabled machine

```bash
cd D:\Nexvia\BE-03
docker compose up -d --build
.venv\Scripts\python.exe scripts/smoke.py
```

Expected smoke output: health/portal OK, key created, positive analysis, one metered call, simulated checkout, webhook upgrade to Pro, Prometheus metrics present, 429 after repeated calls, revoked key rejected.

Note: the Docker Compose stack was not started in the generation environment because Docker is unavailable there.
