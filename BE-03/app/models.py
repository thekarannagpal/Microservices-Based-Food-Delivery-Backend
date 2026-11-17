from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    plan: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stripe_customer_id: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class UsageSummary(Base):
    __tablename__ = "usage_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    hour: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    endpoint_counts: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    key_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    stripe_subscription_id: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    plan: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="inactive", nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
