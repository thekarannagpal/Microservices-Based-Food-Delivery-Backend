"""End-to-end smoke test for the BE-03 API platform."""

import os
import uuid

import httpx

BASE = os.getenv("BASE_URL", "http://localhost:8000")
ADMIN = {"X-Admin-Token": os.getenv("ADMIN_TOKEN", "admin-demo-token")}


def check(response: httpx.Response, expected: int, label: str):
    assert response.status_code == expected, f"{label}: expected {expected}, got {response.status_code} {response.text}"
    return response.json()


def main():
    print(f"BE-03 smoke test -> {BASE}")
    with httpx.Client(base_url=BASE, timeout=10) as client:
        check(client.get("/health"), 200, "health")
        check(client.get("/portal"), 200, "portal")

        key = check(
            client.post(
                "/v1/keys",
                headers=ADMIN,
                json={"owner": f"smoke-{uuid.uuid4().hex[:8]}", "plan": "free"},
            ),
            201,
            "create key",
        )
        headers = {"X-API-Key": key["key"]}
        print("created key:", key["prefix"])

        result = check(
            client.post("/v1/analyze", headers=headers, json={"text": "The food was delicious and fresh!"}),
            200,
            "analyze",
        )
        assert result["sentiment"] == "positive", result
        print("analysis:", result["sentiment"], result["score"])

        usage = check(client.get("/v1/usage", headers=headers), 200, "usage")
        assert usage["current_hour"]["count"] == 1, usage
        print("metered calls:", usage["current_hour"]["count"])

        checkout = check(client.post("/v1/billing/checkout", headers=headers, json={}), 200, "checkout")
        print("checkout simulated:", checkout["simulated"], checkout["session_id"])

        webhook = check(client.post(f"/webhooks/demo/checkout?key_id={key['id']}"), 200, "webhook")
        assert webhook["status"] == "activated", webhook
        plans = check(client.get("/v1/plans", headers=headers), 200, "plans")
        assert plans["pro"]["current_plan"] is True, plans

        metrics = client.get("/metrics")
        assert metrics.status_code == 200 and "api_requests_total" in metrics.text
        print("prometheus metrics: OK")

        limited = False
        for _ in range(15):
            if client.post("/v1/analyze", headers=headers, json={"text": "good"}).status_code == 429:
                limited = True
                break
        assert limited, "rate limiter never returned 429"
        print("redis rate limiting: OK")

        revoke = check(client.post(f"/v1/keys/{key['id']}/revoke", headers=ADMIN), 200, "revoke")
        assert revoke["revoked"] is True
        check(client.post("/v1/analyze", headers=headers, json={"text": "good"}), 401, "revoked key")

    print("\nAll BE-03 smoke checks passed.")


if __name__ == "__main__":
    main()
