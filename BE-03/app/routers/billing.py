from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import current_key
from ..billing import create_checkout
from ..db import get_db
from ..models import APIKey
from ..schemas import CheckoutRequest, CheckoutOut

router = APIRouter(tags=["billing"])


@router.post("/billing/checkout", response_model=CheckoutOut)
def checkout(
    payload: CheckoutRequest,
    key: dict = Depends(current_key),
    db: Session = Depends(get_db),
):
    record = db.query(APIKey).filter(APIKey.id == key["id"]).first()
    return create_checkout(record, db, payload.success_url, payload.cancel_url)
