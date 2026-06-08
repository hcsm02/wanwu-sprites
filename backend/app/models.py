from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class ActivityRecord(Base):
    __tablename__ = "activity_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    activity_title: Mapped[str] = mapped_column(String(120), nullable=False)
    activity_tags: Mapped[str] = mapped_column(String(255), default="")
    activity_steps: Mapped[str] = mapped_column(Text, default="")
    activity_question: Mapped[str] = mapped_column(Text, default="")
    record_prompt: Mapped[str] = mapped_column(Text, default="")
    mood: Mapped[str] = mapped_column(String(40), default="")
    one_line_note: Mapped[str] = mapped_column(Text, default="")
    ai_memory: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
