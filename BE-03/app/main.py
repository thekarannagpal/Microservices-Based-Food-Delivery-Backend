import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

from .auth import hash_api_key
from .cache import get_redis  # noqa: F401 - ensures the Redis singleton is initialised
from .config import PLANS, settings
from .db import SessionLocal, init_db
from .metering import meter
from .metrics import LATENCY, REJECTIONS, REQUESTS, metrics_response
from .models import APIKey
from .portal import portal_html
from .rate_limit import consume_token
from .routers import analyze, api_keys, billing, usage, webhooks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API-as-a-product demo: API keys, Redis rate limits, metering, Stripe billing and a developer portal.",
    lifespan=lifespan,
)


@app.middleware("http")
async def usage_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/v1/"):
        return await call_next(request)

    # Key management is protected by X-Admin-Token in the router, not by an API key.
    if path.startswith("/v1/keys") and request.headers.get("x-admin-token"):
        return await call_next(request)

    started = time.perf_counter()
    endpoint = f"{request.method} {path}"
    raw_key = request.headers.get("x-api-key")
    if not raw_key:
        return JSONResponse(status_code=401, content={"detail": "X-API-Key header required"})

    with SessionLocal() as db:
        record = (
            db.query(APIKey)
            .filter(APIKey.key_hash == hash_api_key(raw_key), APIKey.revoked.is_(False))
            .first()
        )
        if record is None:
            return JSONResponse(status_code=401, content={"detail": "Invalid or revoked API key"})

        plan_name = record.plan if record.plan in PLANS else "free"
        plan = PLANS[plan_name]
        key_info = {"id": record.id, "owner": record.owner, "plan": plan_name}
        limit = consume_token(record.id, plan["rate_per_minute"])

        if not limit.allowed:
            meter(record.id, endpoint, 429)
            REJECTIONS.labels(plan=plan_name).inc()
            LATENCY.labels(endpoint=endpoint).observe(time.perf_counter() - started)
            REQUESTS.labels(endpoint=endpoint, status="429", plan=plan_name).inc()
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "retry_after_seconds": limit.retry_after},
                headers={
                    "Retry-After": str(limit.retry_after),
                    "X-RateLimit-Limit": str(plan["rate_per_minute"]),
                    "X-RateLimit-Remaining": "0",
                },
            )

        request.state.api_key = key_info
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            meter(record.id, endpoint, 500)
            LATENCY.labels(endpoint=endpoint).observe(time.perf_counter() - started)
            REQUESTS.labels(endpoint=endpoint, status="500", plan=plan_name).inc()
            raise

        meter(record.id, endpoint, status_code)
        LATENCY.labels(endpoint=endpoint).observe(time.perf_counter() - started)
        REQUESTS.labels(endpoint=endpoint, status=str(status_code), plan=plan_name).inc()
        response.headers["X-RateLimit-Limit"] = str(plan["rate_per_minute"])
        response.headers["X-RateLimit-Remaining"] = str(limit.remaining)
        return response


app.include_router(api_keys.router, prefix="/v1")
app.include_router(analyze.router, prefix="/v1")
app.include_router(usage.router, prefix="/v1")
app.include_router(billing.router, prefix="/v1")
app.include_router(webhooks.router, prefix="/webhooks")


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "nexvia-api-platform"}


@app.get("/metrics", tags=["meta"])
def metrics():
    return metrics_response()


@app.get("/portal", response_class=HTMLResponse, tags=["meta"], include_in_schema=False)
def portal():
    return HTMLResponse(portal_html())
