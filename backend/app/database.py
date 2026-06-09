from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "sqlite" / "wanwu_sprites.db"
DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

if DATABASE_URL.startswith("sqlite:///"):
    raw_path = DATABASE_URL.removeprefix("sqlite:///")
    candidate_path = Path(raw_path)
    if not candidate_path.is_absolute():
        candidate_path = Path(__file__).resolve().parents[2] / candidate_path
    candidate_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{candidate_path.resolve()}"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_database_details() -> dict[str, str | bool | None]:
    db_path: str | None = None
    if DATABASE_URL.startswith("sqlite:///"):
        raw_path = DATABASE_URL.removeprefix("sqlite:///")
        db_path = str(Path(raw_path).resolve())

    return {
        "url": DATABASE_URL,
        "is_sqlite": DATABASE_URL.startswith("sqlite"),
        "resolved_path": db_path,
        "path_exists": Path(db_path).exists() if db_path else False,
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
