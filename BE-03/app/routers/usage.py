from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import current_key
from ..db import get_db
from ..metering import read_current_hour
from ..models import UsageSummary
from ..schemas import UsageOut

router = APIRouter(tags=["usage"])


@router.get("/usage", response_model=UsageOut)
def usage(key: dict = Depends(current_key), db: Session = Depends(get_db)):
    summaries = (
        db.query(UsageSummary)
        .filter(UsageSummary.key_id == key["id"])
        .order_by(UsageSummary.hour.desc())
        .limit(24)
        .all()
    )
    return UsageOut(
        key_id=key["id"],
        current_hour=read_current_hour(key["id"]),
        summaries=[
            {
                "hour": row.hour,
                "request_count": row.request_count,
                "endpoint_counts": row.endpoint_counts,
            }
            for row in summaries
        ],
    )
