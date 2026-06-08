from __future__ import annotations

import json
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .ai_service import create_memory, recommend_activity
from .database import Base, engine, get_db
from .models import ActivityRecord
from .schemas import ActivityCard, ActivityContext, ActivityRecordOut, CreateRecordRequest

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="玩悟精灵 Wanwu Sprites API", version="0.1.0")

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DbSession = Annotated[Session, Depends(get_db)]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/activity/recommend", response_model=ActivityCard)
def recommend(context: ActivityContext) -> ActivityCard:
    return recommend_activity(context)


@app.post("/api/records", response_model=ActivityRecordOut)
def create_record(payload: CreateRecordRequest, db: DbSession) -> ActivityRecordOut:
    memory = create_memory(
        activity_title=payload.activity.title,
        mood=payload.mood,
        one_line_note=payload.one_line_note,
    )

    record = ActivityRecord(
        activity_title=payload.activity.title,
        activity_tags=json.dumps(payload.activity.tags, ensure_ascii=False),
        activity_steps=json.dumps(payload.activity.steps, ensure_ascii=False),
        activity_question=payload.activity.question,
        record_prompt=payload.activity.record_prompt,
        mood=payload.mood,
        one_line_note=payload.one_line_note,
        ai_memory=memory,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_record_out(record)


@app.get("/api/records", response_model=list[ActivityRecordOut])
def list_records(db: DbSession) -> list[ActivityRecordOut]:
    records = db.scalars(select(ActivityRecord).order_by(ActivityRecord.created_at.desc())).all()
    return [_to_record_out(record) for record in records]


def _loads_list(value: str) -> list[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _to_record_out(record: ActivityRecord) -> ActivityRecordOut:
    return ActivityRecordOut(
        id=record.id,
        activity_title=record.activity_title,
        activity_tags=_loads_list(record.activity_tags),
        activity_steps=_loads_list(record.activity_steps),
        activity_question=record.activity_question,
        record_prompt=record.record_prompt,
        mood=record.mood,
        one_line_note=record.one_line_note,
        ai_memory=record.ai_memory,
        created_at=record.created_at,
    )
