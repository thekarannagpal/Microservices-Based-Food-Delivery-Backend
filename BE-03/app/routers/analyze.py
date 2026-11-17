from fastapi import APIRouter, Depends

from ..analyzer import analyze_text
from ..auth import current_key
from ..config import PLANS
from ..schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter(tags=["sample-api"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest, key: dict = Depends(current_key)):
    return analyze_text(payload.text)


@router.get("/plans")
def plans(key: dict = Depends(current_key)):
    return {
        name: {**plan, "current_plan": key["plan"] == name}
        for name, plan in PLANS.items()
    }
