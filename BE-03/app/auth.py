import hashlib
import hmac
import secrets

from fastapi import Header, HTTPException, Request

from .config import settings


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    # `nex_test_` marks test-mode keys; never accept live-mode keys in this demo.
    return "nex_test_" + secrets.token_urlsafe(24)


def require_admin(x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> None:
    if not x_admin_token or not hmac.compare_digest(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=401, detail="Admin token required")


def current_key(request: Request) -> dict:
    key = getattr(request.state, "api_key", None)
    if not key:
        raise HTTPException(status_code=401, detail="Valid X-API-Key required")
    return key
