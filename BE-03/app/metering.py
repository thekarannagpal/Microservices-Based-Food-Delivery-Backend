"""Per-call metering in Redis; Celery aggregates the counters into PostgreSQL."""

import json
from datetime import datetime, timezone

from .cache import get_redis


def hour_bucket(moment: datetime | None = None) -> str:
    return (moment or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H")


def meter(key_id: str, endpoint: str, status_code: int, moment: datetime | None = None) -> None:
    redis = get_redis()
    hour = hour_bucket(moment)
    counter = f"usage:{key_id}:{hour}"
    moment = moment or datetime.now(timezone.utc)

    pipe = redis.pipeline()
    pipe.hincrby(counter, "count", 1)
    pipe.hincrby(counter, f"endpoint:{endpoint}", 1)
    pipe.hincrby(counter, f"status:{status_code}", 1)
    pipe.expire(counter, 60 * 60 * 48)
    pipe.lpush(
        "usage_events",
        json.dumps(
            {
                "key_id": key_id,
                "endpoint": endpoint,
                "status_code": status_code,
                "occurred_at": moment.isoformat(),
            }
        ),
    )
    pipe.ltrim("usage_events", 0, 9999)
    pipe.execute()


def read_current_hour(key_id: str) -> dict[str, str | int]:
    raw = get_redis().hgetall(f"usage:{key_id}:{hour_bucket()}")
    return {key: int(value) if str(value).lstrip("-").isdigit() else value for key, value in raw.items()}
