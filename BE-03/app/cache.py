from .config import settings

_client = None


def get_redis():
    """Return a process-wide Redis client.

    `REDIS_URL=memory://` uses fakeredis for tests/local runs without Redis.
    """
    global _client
    if _client is None:
        if settings.redis_url.startswith("memory://"):
            from fakeredis import FakeRedis

            _client = FakeRedis(decode_responses=True)
        else:
            import redis

            _client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    return _client
