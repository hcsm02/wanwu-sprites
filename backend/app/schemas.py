from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ActivityContext(BaseModel):
    duration: str = Field(default="5-15分钟")
    location: str = Field(default="家里")
    materials: str = Field(default="不用材料")
    child_state: str = Field(default="随便推荐")
    child_age: Optional[int] = Field(default=None, ge=1, le=18)


class ActivityCard(BaseModel):
    title: str
    tags: list[str]
    intro: str
    steps: list[str]
    question: str
    record_prompt: str
    sprite_tip: str


class EnsureUserRequest(BaseModel):
    browser_id: str = Field(min_length=8, max_length=120)
    nickname: Optional[str] = Field(default=None, max_length=80)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    phone_number: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=6, max_length=120)
    nickname: Optional[str] = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    phone_number: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=6, max_length=120)


class UserOut(BaseModel):
    id: int
    nickname: str
    username: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class CreateRecordRequest(BaseModel):
    activity: ActivityCard
    mood: str = Field(default="开心")
    one_line_note: str = Field(default="")


class ActivityRecordOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    activity_title: str
    activity_tags: list[str]
    activity_steps: list[str]
    activity_question: str
    record_prompt: str
    mood: str
    one_line_note: str
    ai_memory: str
    created_at: datetime

    class Config:
        from_attributes = True
