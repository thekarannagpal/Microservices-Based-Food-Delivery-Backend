import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import generate_api_key, hash_api_key, require_admin
from ..db import get_db
from ..models import APIKey
from ..schemas import KeyCreate, KeyOut

router = APIRouter(tags=["api-keys"])


@router.post("/keys", response_model=KeyOut, status_code=status.HTTP_201_CREATED)
def create_key(payload: KeyCreate, _admin: None = Depends(require_admin), db: Session = Depends(get_db)):
    raw_key = generate_api_key()
    record = APIKey(
        id=str(uuid.uuid4()),
        owner=payload.owner,
        key_hash=hash_api_key(raw_key),
        prefix=raw_key[:12],
        plan=payload.plan,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return KeyOut(
        id=record.id,
        owner=record.owner,
        prefix=record.prefix,
        plan=record.plan,
        revoked=record.revoked,
        created_at=record.created_at,
        key=raw_key,
    )


@router.get("/keys", response_model=list[KeyOut], response_model_exclude_none=True)
def list_keys(_admin: None = Depends(require_admin), db: Session = Depends(get_db)):
    return [
        KeyOut(
            id=key.id,
            owner=key.owner,
            prefix=key.prefix,
            plan=key.plan,
            revoked=key.revoked,
            created_at=key.created_at,
        )
        for key in db.query(APIKey).all()
    ]


@router.post("/keys/{key_id}/revoke", response_model=KeyOut, response_model_exclude_none=True)
def revoke_key(key_id: str, _admin: None = Depends(require_admin), db: Session = Depends(get_db)):
    record = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="API key not found")
    record.revoked = True
    db.commit()
    db.refresh(record)
    return KeyOut(
        id=record.id,
        owner=record.owner,
        prefix=record.prefix,
        plan=record.plan,
        revoked=record.revoked,
        created_at=record.created_at,
    )
