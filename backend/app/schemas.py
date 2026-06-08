from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ActivityContext(BaseModel):
    duration: str = Field(default="5-15分钟")
    location: str = Field(default="家里")
    materials: str = Field(default="不用材料")
    child_state: str = Field(default="随便推荐")
    child_age: Optional[int] = Field(default=None, ge=1, le=18)


class ActivityCard(BaseModel):
    title: str
    tags: List[str]
    intro: str
    steps: List[str]
    question: str
    record_prompt: str
    sprite_tip: str


class CreateRecordRequest(BaseModel):
    activity: ActivityCard
    mood: str = Field(default="开心")
    one_line_note: str = Field(default="")


class ActivityRecordOut(BaseModel):
    id: int
    activity_title: str
    activity_tags: List[str]
    activity_steps: List[str]
    activity_question: str
    record_prompt: str
    mood: str
    one_line_note: str
    ai_memory: str
    created_at: datetime

    class Config:
        from_attributes = True
