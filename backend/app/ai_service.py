from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from .schemas import ActivityCard, ActivityContext

load_dotenv()


def _get_ai_settings() -> tuple[str, str, str]:
    return (
        os.getenv("OPENAI_API_KEY", "").strip(),
        os.getenv("OPENAI_MODEL", "").strip(),
        os.getenv("OPENAI_BASE_URL", "").strip(),
    )


def _get_client() -> OpenAI | None:
    api_key, _, base_url = _get_ai_settings()
    if not api_key:
        return None
    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


def get_ai_status(check_connection: bool = False) -> dict[str, Any]:
    api_key, model, base_url = _get_ai_settings()
    status: dict[str, Any] = {
        "configured": bool(api_key and model),
        "has_api_key": bool(api_key),
        "model": model or None,
        "base_url": base_url or None,
        "using_fallback": not bool(api_key and model),
        "connection_ok": None,
        "connection_error": None,
    }

    if not check_connection:
        return status

    client = _get_client()
    if client is None or not model:
        status["connection_ok"] = False
        status["connection_error"] = "LLM is not fully configured."
        return status

    try:
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            temperature=0,
            max_tokens=1,
        )
        status["connection_ok"] = True
    except Exception as exc:
        status["connection_ok"] = False
        status["connection_error"] = str(exc)

    return status


def _safe_json_loads(text: str) -> dict[str, Any] | None:
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return None
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def recommend_activity_with_debug(context: ActivityContext) -> tuple[ActivityCard, dict[str, Any]]:
    client = _get_client()
    api_key, model, base_url = _get_ai_settings()
    debug: dict[str, Any] = {
        "feature": "recommend_activity",
        "llm_configured": bool(client is not None and api_key and model),
        "model": model or None,
        "base_url": base_url or None,
        "used_fallback": False,
        "fallback_reason": None,
        "raw_content": None,
        "error": None,
    }

    if client is None or not api_key or not model:
        debug["used_fallback"] = True
        debug["fallback_reason"] = "missing_api_key_or_model"
        raise RuntimeError("LLM 未配置，推荐功能不可用。")

    prompt = f"""
你是“玩悟精灵”的亲子活动推荐助手。请根据当前场景只生成 1 个低门槛亲子活动。

当前场景：
- 时间：{context.duration}
- 地点：{context.location}
- 材料：{context.materials}
- 孩子状态：{context.child_state}
- 孩子年龄：{context.child_age or "未知"}

要求：
- 活动必须马上能做
- 不要写成课程教案
- 步骤最多 3 步
- 总时长控制在 5 到 15 分钟
- 材料越少越好
- 给出 1 个亲子提问
- 给出 1 个记录提示
- 语言简洁、温和、适合手机阅读
- 只输出 JSON，不要输出 Markdown

JSON 结构：
{{
  "title": "活动标题",
  "tags": ["5分钟", "家里", "不用材料"],
  "intro": "一句话说明怎么玩",
  "steps": ["步骤1", "步骤2", "步骤3"],
  "question": "一个亲子提问",
  "record_prompt": "一个记录提示",
  "sprite_tip": "玩悟精灵的一句提醒"
}}
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你只能输出严格 JSON。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
        )
        content = response.choices[0].message.content or ""
        debug["raw_content"] = content
        data = _safe_json_loads(content)
        if data is None:
            debug["used_fallback"] = True
            debug["fallback_reason"] = "invalid_json_from_llm"
            raise RuntimeError("LLM 返回的推荐结果不是合法 JSON。")
        return ActivityCard(**data), debug
    except Exception as exc:
        debug["used_fallback"] = True
        if debug["fallback_reason"] is None:
            debug["fallback_reason"] = "llm_request_failed"
        debug["error"] = str(exc)
        raise RuntimeError(str(exc))


def recommend_activity(context: ActivityContext) -> ActivityCard:
    card, _ = recommend_activity_with_debug(context)
    return card


def create_memory_with_debug(activity_title: str, mood: str, one_line_note: str) -> tuple[str, dict[str, Any]]:
    clean_note = one_line_note.strip() or "我们完成了这个小活动。"
    client = _get_client()
    api_key, model, base_url = _get_ai_settings()
    debug: dict[str, Any] = {
        "feature": "create_memory",
        "llm_configured": bool(client is not None and api_key and model),
        "model": model or None,
        "base_url": base_url or None,
        "used_fallback": False,
        "fallback_reason": None,
        "raw_content": None,
        "error": None,
        "normalized_note": clean_note,
    }

    if client is None or not api_key or not model:
        debug["used_fallback"] = True
        debug["fallback_reason"] = "missing_api_key_or_model"
        return f"今天我们一起完成了《{activity_title}》。当时的感受是“{mood}”。{clean_note}", debug

    prompt = f"""
你是“玩悟精灵”，负责把家长的一句话记录整理成简短、真实、温和的亲子记忆。

活动：{activity_title}
感受：{mood}
家长记录：{clean_note}

要求：
- 100 到 180 字
- 不夸张，不编造具体事实
- 保留真实感受、互动瞬间和可回看的记忆感
- 不要写成教育评估报告
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是温和、克制、真实的亲子记忆整理助手。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
        )
        content = (response.choices[0].message.content or "").strip()
        debug["raw_content"] = content
        return content, debug
    except Exception as exc:
        debug["used_fallback"] = True
        debug["fallback_reason"] = "llm_request_failed"
        debug["error"] = str(exc)
        return f"今天我们一起完成了《{activity_title}》。当时的感受是“{mood}”。{clean_note}", debug


def create_memory(activity_title: str, mood: str, one_line_note: str) -> str:
    memory, _ = create_memory_with_debug(activity_title, mood, one_line_note)
    return memory
