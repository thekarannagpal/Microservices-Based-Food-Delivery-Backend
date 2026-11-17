from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from fastapi import Response

REQUESTS = Counter(
    "api_requests_total",
    "API requests by endpoint, status and plan",
    ["endpoint", "status", "plan"],
)
LATENCY = Histogram(
    "api_request_duration_seconds",
    "API request duration in seconds",
    ["endpoint"],
)
REJECTIONS = Counter(
    "api_rate_limit_rejections_total",
    "Requests rejected by the rate limiter",
    ["plan"],
)


def metrics_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
