"""Redis token bucket limiter.

A single bucket per API key refills continuously up to the plan's per-minute
capacity. Production deployments should replace the read/modify/write section
with the equivalent Lua script for strict atomicity; the interface is unchanged.
"""

from dataclasses import dataclass
import time

from .cache import get_redis


@dataclass
class LimitResult:
    allowed: bool
    remaining: int
    retry_after: int


def consume_token(key_id: str, capacity: int) -> LimitResult:
    redis = get_redis()
    bucket = f"ratelimit:{key_id}"
    now = time.time()
    rate = capacity / 60.0

    raw = redis.hmget(bucket, "tokens", "ts")
    tokens = float(raw[0]) if raw[0] is not None else float(capacity)
    updated_at = float(raw[1]) if raw[1] is not None else now

    tokens = min(float(capacity), tokens + max(0.0, now - updated_at) * rate)
    allowed = tokens >= 1.0
    if allowed:
        tokens -= 1.0
    else:
        tokens = 0.0

    pipe = redis.pipeline()
    pipe.hset(bucket, mapping={"tokens": tokens, "ts": now})
    pipe.expire(bucket, 120)
    pipe.execute()

    retry_after = 0 if allowed else max(1, int((1.0 - tokens) / rate) + 1)
    return LimitResult(allowed=allowed, remaining=int(tokens), retry_after=retry_after)
