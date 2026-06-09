from __future__ import annotations

import json
import logging
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .ai_service import create_memory_with_debug, get_ai_status, recommend_activity_with_debug
from .auth import hash_password, new_salt, new_session_token, normalize_phone, normalize_username, verify_password
from .database import Base, engine, get_database_details, get_db
from .models import ActivityRecord, User
from .schemas import (
    ActivityCard,
    ActivityContext,
    ActivityRecordOut,
    AuthResponse,
    CreateRecordRequest,
    EnsureUserRequest,
    LoginRequest,
    RegisterRequest,
    UserOut,
)

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Wanwu Sprites API", version="0.1.0")
logger = logging.getLogger("uvicorn.error")

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DbSession = Annotated[Session, Depends(get_db)]


def _log_event(event: str, payload: dict[str, object]) -> None:
    logger.info("%s %s", event, json.dumps(payload, ensure_ascii=False, default=str))


def _ensure_column(table_name: str, column_name: str, sql: str) -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns(table_name)} if inspector.has_table(table_name) else set()
    if column_name not in columns:
        with engine.begin() as connection:
            connection.execute(text(sql))


def _ensure_schema() -> None:
    _ensure_column("activity_records", "user_id", "ALTER TABLE activity_records ADD COLUMN user_id INTEGER")
    _ensure_column("users", "username", "ALTER TABLE users ADD COLUMN username VARCHAR(40)")
    _ensure_column("users", "phone_number", "ALTER TABLE users ADD COLUMN phone_number VARCHAR(20)")
    _ensure_column("users", "password_salt", "ALTER TABLE users ADD COLUMN password_salt VARCHAR(64)")
    _ensure_column("users", "password_hash", "ALTER TABLE users ADD COLUMN password_hash VARCHAR(128)")
    _ensure_column("users", "session_token", "ALTER TABLE users ADD COLUMN session_token VARCHAR(120)")

    with engine.begin() as connection:
        connection.execute(text("DROP INDEX IF EXISTS ix_users_username_unique"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_username_lookup ON users (username)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone_number_unique ON users (phone_number)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_session_token_unique ON users (session_token)"))


def _build_default_nickname(browser_id: str) -> str:
    suffix = browser_id[-4:] if len(browser_id) >= 4 else browser_id
    return f"Family-{suffix}"


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        nickname=user.nickname,
        username=user.username,
        phone_number=user.phone_number,
        created_at=user.created_at,
    )


def _build_auth_response(user: User) -> AuthResponse:
    if not user.session_token:
        raise HTTPException(status_code=500, detail="User session token is missing.")
    return AuthResponse(token=user.session_token, user=_to_user_out(user))


def _resolve_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header.")
    return token.strip()


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User:
    token = _resolve_token(authorization)
    user = db.scalar(select(User).where(User.session_token == token))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    return user


_ensure_schema()


@app.get("/health")
def health(
    db: DbSession,
    check_ai: bool = Query(default=False, description="Run a lightweight LLM connectivity check."),
) -> dict[str, object]:
    database = get_database_details()
    records_count = db.query(ActivityRecord).count()
    users_count = db.query(User).count()
    latest_record = db.scalars(select(ActivityRecord).order_by(ActivityRecord.created_at.desc()).limit(1)).first()

    result = {
        "status": "ok",
        "database": {
            **database,
            "records_count": records_count,
            "users_count": users_count,
            "latest_record": _to_record_out(latest_record).dict() if latest_record else None,
        },
        "llm": get_ai_status(check_connection=check_ai),
    }
    _log_event("health", result)
    return result


@app.post("/api/users/ensure", response_model=UserOut)
def ensure_user(payload: EnsureUserRequest, db: DbSession) -> UserOut:
    user = db.scalar(select(User).where(User.browser_id == payload.browser_id))
    if user is None:
        user = User(
            browser_id=payload.browser_id,
            nickname=(payload.nickname or _build_default_nickname(payload.browser_id)).strip() or _build_default_nickname(payload.browser_id),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        result = _to_user_out(user)
        _log_event("ensure_user_created", result.dict())
        return result

    if payload.nickname and payload.nickname.strip() and payload.nickname.strip() != user.nickname:
        user.nickname = payload.nickname.strip()
        db.add(user)
        db.commit()
        db.refresh(user)

    result = _to_user_out(user)
    _log_event("ensure_user_existing", result.dict())
    return result


@app.post("/api/auth/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: DbSession) -> AuthResponse:
    username = normalize_username(payload.username)
    phone_number = normalize_phone(payload.phone_number)
    existing = db.scalar(select(User).where(User.phone_number == phone_number))
    if existing is not None:
        raise HTTPException(status_code=409, detail="该手机号已注册。")

    salt = new_salt()
    user = User(
        browser_id=f"acct:{phone_number}",
        nickname=(payload.nickname or payload.username).strip() or payload.username,
        username=username,
        phone_number=phone_number,
        password_salt=salt,
        password_hash=hash_password(payload.password, salt),
        session_token=new_session_token(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    result = _build_auth_response(user)
    _log_event("register", {"user": result.user.dict()})
    return result


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DbSession) -> AuthResponse:
    phone_number = normalize_phone(payload.phone_number)
    user = db.scalar(select(User).where(User.phone_number == phone_number))
    if user is None or not user.password_salt or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手机号或密码错误。")

    if not verify_password(payload.password, user.password_salt, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手机号或密码错误。")

    user.session_token = new_session_token()
    db.add(user)
    db.commit()
    db.refresh(user)

    result = _build_auth_response(user)
    _log_event("login", {"user": result.user.dict()})
    return result


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    result = _to_user_out(current_user)
    _log_event("auth_me", result.dict())
    return result


@app.post("/api/activity/recommend", response_model=ActivityCard)
def recommend(context: ActivityContext) -> ActivityCard:
    try:
        result, debug = recommend_activity_with_debug(context)
        _log_event(
            "recommend",
            {
                "request": context.model_dump(),
                "response": result.model_dump(),
                "debug": debug,
                "llm": get_ai_status(check_connection=False),
            },
        )
        return result
    except RuntimeError as exc:
        debug = {
            "feature": "recommend_activity",
            "used_fallback": True,
            "fallback_reason": "disabled_demo_data",
            "error": str(exc),
        }
        _log_event(
            "recommend_failed",
            {
                "request": context.model_dump(),
                "debug": debug,
                "llm": get_ai_status(check_connection=False),
            },
        )
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/api/records", response_model=ActivityRecordOut)
def create_record(payload: CreateRecordRequest, current_user: Annotated[User, Depends(get_current_user)], db: DbSession) -> ActivityRecordOut:
    memory, memory_debug = create_memory_with_debug(
        activity_title=payload.activity.title,
        mood=payload.mood,
        one_line_note=payload.one_line_note,
    )

    record = ActivityRecord(
        user_id=current_user.id,
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

    result = _to_record_out(record)
    _log_event(
        "create_record",
        {
            "request": payload.model_dump(),
            "response": result.dict(),
            "user": _to_user_out(current_user).dict(),
            "debug": memory_debug,
            "llm": get_ai_status(check_connection=False),
        },
    )
    return result


@app.get("/api/records", response_model=list[ActivityRecordOut])
def list_records(current_user: Annotated[User, Depends(get_current_user)], db: DbSession) -> list[ActivityRecordOut]:
    records = db.scalars(
        select(ActivityRecord).where(ActivityRecord.user_id == current_user.id).order_by(ActivityRecord.created_at.desc())
    ).all()
    result = [_to_record_out(record) for record in records]
    _log_event(
        "list_records",
        {
            "user": _to_user_out(current_user).dict(),
            "count": len(result),
            "latest_record": result[0].dict() if result else None,
        },
    )
    return result


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
        user_id=record.user_id,
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
