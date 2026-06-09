from __future__ import annotations

import hashlib
import hmac
import secrets


def normalize_username(username: str) -> str:
    return username.strip()


def normalize_phone(phone_number: str) -> str:
    return phone_number.strip()


def new_salt() -> str:
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000).hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected_hash)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)
