from conftest import ADMIN, create_key


def test_health_portal_and_metrics(client):
    assert client.get("/health").json()["status"] == "ok"
    assert "Developer Portal" in client.get("/portal").text
    assert "api_requests_total" in client.get("/metrics").text
    spec = client.get("/openapi.json").json()
    assert "/v1/analyze" in spec["paths"]
    assert "/v1/keys" in spec["paths"]


def test_api_key_hashing_revocation(client):
    key = create_key(client)
    assert key["key"].startswith("nex_test_")
    assert key["prefix"] == key["key"][:12]
    listed = client.get("/v1/keys", headers=ADMIN).json()
    assert len(listed) == 1
    assert "key" not in listed[0]

    headers = {"X-API-Key": key["key"]}
    assert client.post("/v1/analyze", headers=headers, json={"text": "Great food"}).status_code == 200

    assert client.post(f"/v1/keys/{key['id']}/revoke", headers=ADMIN).status_code == 200
    response = client.post("/v1/analyze", headers=headers, json={"text": "Great food"})
    assert response.status_code == 401


def test_missing_and_invalid_keys(client):
    assert client.post("/v1/analyze", json={"text": "hello"}).status_code == 401
    assert client.post("/v1/analyze", headers={"X-API-Key": "wrong"}, json={"text": "hello"}).status_code == 401
    assert client.post("/v1/keys", json={"owner": "x", "plan": "free"}).status_code == 401


def test_redis_token_bucket_rate_limit(client):
    key = create_key(client)
    headers = {"X-API-Key": key["key"]}
    statuses = [
        client.post("/v1/analyze", headers=headers, json={"text": "nice"}).status_code
        for _ in range(4)
    ]
    assert statuses == [200, 200, 200, 429]

    limited = client.post("/v1/analyze", headers=headers, json={"text": "nice"})
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) >= 1
    assert limited.headers["X-RateLimit-Limit"] == "3"


def test_metering_counts_every_call(client):
    key = create_key(client, plan="pro")
    headers = {"X-API-Key": key["key"]}
    for text in ["good", "bad", "okay"]:
        client.post("/v1/analyze", headers=headers, json={"text": text})

    usage = client.get("/v1/usage", headers=headers).json()
    assert usage["key_id"] == key["id"]
    assert usage["current_hour"]["count"] == 3
    assert usage["current_hour"]["endpoint:POST /v1/analyze"] == 3


def test_sentiment_engine(client):
    key = create_key(client, plan="pro")
    headers = {"X-API-Key": key["key"]}
    positive = client.post("/v1/analyze", headers=headers, json={"text": "Delicious and amazing food!"}).json()
    negative = client.post("/v1/analyze", headers=headers, json={"text": "Terrible, cold and late."}).json()
    neutral = client.post("/v1/analyze", headers=headers, json={"text": "The package arrived at noon."}).json()

    assert positive["sentiment"] == "positive"
    assert negative["sentiment"] == "negative"
    assert neutral["sentiment"] == "neutral"
    assert positive["keywords"] == ["delicious", "amazing"]


def test_billing_checkout_and_webhook_upgrade_plan(client):
    key = create_key(client)
    headers = {"X-API-Key": key["key"]}
    checkout = client.post("/v1/billing/checkout", headers=headers, json={}).json()
    assert checkout["simulated"] is True
    assert checkout["url"].startswith("https://checkout.stripe.com/")

    event = client.post(f"/webhooks/demo/checkout?key_id={key['id']}")
    assert event.json()["status"] == "activated"

    plans = client.get("/v1/plans", headers=headers).json()
    assert plans["pro"]["current_plan"] is True

    # Replaying the same Stripe event is idempotent.
    assert client.post(f"/webhooks/demo/checkout?key_id={key['id']}").json()["status"] == "duplicate"


def test_celery_aggregation_writes_summaries(client):
    from app.tasks import aggregate_usage

    key = create_key(client)
    headers = {"X-API-Key": key["key"]}
    client.post("/v1/analyze", headers=headers, json={"text": "fresh and tasty"})

    result = aggregate_usage()
    assert result["summaries"] >= 1

    summaries = client.get("/v1/usage", headers=headers).json()["summaries"]
    assert any(row["request_count"] == 1 for row in summaries)
