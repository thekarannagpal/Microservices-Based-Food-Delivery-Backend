import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..billing import apply_webhook_event
from ..config import settings
from ..db import get_db

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if settings.stripe_webhook_secret:
        try:
            import stripe

            event = stripe.Webhook.construct_event(
                body, request.headers.get("stripe-signature", ""), settings.stripe_webhook_secret
            )
            payload = event
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Invalid Stripe signature: {error}") from error
    else:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=400, detail="Invalid JSON payload") from error
    return apply_webhook_event(payload, db)


@router.post("/demo/checkout")
def demo_checkout(key_id: str, db: Session = Depends(get_db)):
    """Test-mode helper that emits the same event Stripe would send."""
    return apply_webhook_event(
        {
            "type": "checkout.session.completed",
            "data": {"object": {"metadata": {"key_id": key_id}, "subscription": f"sub_demo_{key_id[:8]}"}},
        },
        db,
    )
