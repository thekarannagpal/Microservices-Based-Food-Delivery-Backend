"""Stripe test-mode billing with a simulated fallback when no key is configured."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .config import PLANS, settings
from .models import APIKey, Subscription


def _stripe():
    if not settings.stripe_secret_key:
        return None
    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


def create_checkout(key: APIKey, db: Session, success_url: str, cancel_url: str) -> dict:
    stripe = _stripe()
    if stripe is None:
        session_id = f"cs_test_simulated_{uuid.uuid4().hex[:16]}"
        return {
            "url": f"https://checkout.stripe.com/c/pay/{session_id}",
            "session_id": session_id,
            "simulated": True,
        }

    customer_id = key.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=f"{key.owner}@example.test",
            metadata={"key_id": key.id},
        )
        customer_id = customer.id
        key.stripe_customer_id = customer_id
        db.add(key)
        db.commit()

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price_data": {
            "currency": "usd",
            "unit_amount": PLANS["pro"]["price_cents"],
            "recurring": {"interval": "month"},
            "product_data": {"name": "Nexvia API Pro"},
        }, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"key_id": key.id},
    )
    return {"url": session.url, "session_id": session.id, "simulated": False}


def apply_webhook_event(payload: dict, db: Session) -> dict:
    """Idempotently apply checkout/subscription events from Stripe or a demo payload."""
    event_type = payload.get("type", "")
    data = payload.get("data", {}).get("object", {})
    key_id = data.get("metadata", {}).get("key_id") or payload.get("key_id")
    key = db.query(APIKey).filter(APIKey.id == key_id).first() if key_id else None
    if not key:
        return {"status": "ignored", "reason": "unknown key"}

    if event_type == "checkout.session.completed":
        subscription_id = data.get("subscription", f"sub_simulated_{uuid.uuid4().hex[:12]}")
        existing = db.query(Subscription).filter_by(stripe_subscription_id=subscription_id).first()
        if existing:
            return {"status": "duplicate"}
        key.plan = "pro"
        db.add(Subscription(
            id=str(uuid.uuid4()),
            key_id=key.id,
            stripe_subscription_id=subscription_id,
            plan="pro",
            status="active",
            current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
        ))
        db.commit()
        return {"status": "activated", "plan": "pro"}

    if event_type in {"customer.subscription.deleted", "customer.subscription.updated"}:
        sub = db.query(Subscription).filter_by(stripe_subscription_id=data.get("id", "")).first()
        if sub:
            active = event_type == "customer.subscription.updated" and data.get("status") == "active"
            sub.status = "active" if active else "canceled"
            key.plan = "pro" if active else "free"
            db.commit()
            return {"status": sub.status}
    return {"status": "ignored", "event": event_type}
