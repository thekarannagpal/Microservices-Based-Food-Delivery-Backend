from datetime import datetime

from pydantic import BaseModel, Field


class KeyCreate(BaseModel):
    owner: str = Field(min_length=2, max_length=120)
    plan: str = Field(default="free", pattern="^(free|pro)$")


class KeyOut(BaseModel):
    id: str
    owner: str
    prefix: str
    plan: str
    revoked: bool
    created_at: datetime
    key: str | None = None  # returned only once on creation


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class AnalyzeResponse(BaseModel):
    sentiment: str
    score: float
    word_count: int
    character_count: int
    sentence_count: int
    keywords: list[str]
    engine: str = "lexicon-v1"


class UsageOut(BaseModel):
    key_id: str
    current_hour: dict[str, str | int]
    summaries: list[dict]


class CheckoutRequest(BaseModel):
    success_url: str = "http://localhost:8000/portal?checkout=success"
    cancel_url: str = "http://localhost:8000/portal?checkout=cancelled"


class CheckoutOut(BaseModel):
    url: str
    session_id: str
    simulated: bool
