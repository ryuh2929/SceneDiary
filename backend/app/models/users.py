from datetime import datetime

from sqlalchemy import Boolean, CHAR, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    device_id: Mapped[str] = mapped_column(CHAR(100), primary_key=True)
    nickname: Mapped[str | None] = mapped_column(CHAR(50), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(CHAR(500), nullable=True)
    writing_persona: Mapped[str | None] = mapped_column(CHAR(50), nullable=True)
    dark_mode: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    push_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
