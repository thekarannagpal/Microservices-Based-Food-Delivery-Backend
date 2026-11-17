import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "memory://"
os.environ["ADMIN_TOKEN"] = "admin-demo-token"
os.environ["FREE_RATE_PER_MINUTE"] = "3"
os.environ["PRO_RATE_PER_MINUTE"] = "10"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.cache import get_redis  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = {"X-Admin-Token": "admin-demo-token"}


@pytest.fixture(autouse=True)
def reset_state():
    get_redis().flushall()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def create_key(client, plan="free", owner="dev@example.test"):
    response = client.post("/v1/keys", headers=ADMIN, json={"owner": owner, "plan": plan})
    assert response.status_code == 201, response.text
    return response.json()
