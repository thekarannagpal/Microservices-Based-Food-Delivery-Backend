"""Celery worker and beat schedule for usage aggregation."""

from celery import Celery

from .cache import get_redis
from .config import settings
from .db import SessionLocal
from .models import UsageSummary

celery_app = Celery("nexvia_api_platform", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.beat_schedule = {
    "aggregate-usage-every-5-minutes": {
        "task": "app.tasks.aggregate_usage",
        "schedule": 300.0,
    }
}
celery_app.conf.timezone = "UTC"


@celery_app.task(name="app.tasks.aggregate_usage")
def aggregate_usage() -> dict:
    """Copy hourly Redis counters into PostgreSQL for billing and reporting."""
    redis = get_redis()
    processed = 0
    for raw_key in redis.scan_iter(match="usage:*:*"):
        parts = raw_key.split(":")
        if len(parts) != 3:
            continue
        _, key_id, hour = parts
        values = redis.hgetall(raw_key)
        count = int(values.get("count", 0))
        endpoints = {
            name.removeprefix("endpoint:"): int(value)
            for name, value in values.items()
            if name.startswith("endpoint:")
        }

        with SessionLocal() as db:
            summary = (
                db.query(UsageSummary)
                .filter(UsageSummary.key_id == key_id, UsageSummary.hour == hour)
                .first()
            )
            if summary is None:
                summary = UsageSummary(key_id=key_id, hour=hour)
                db.add(summary)
            summary.request_count = count
            summary.endpoint_counts = endpoints
            db.commit()
        processed += 1
    return {"summaries": processed}
