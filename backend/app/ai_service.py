from __future__ import annotations

import json
import os
import random
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from .schemas import ActivityCard, ActivityContext

load_dotenv()

FALLBACK_ACTIVITIES: list[ActivityCard] = [
    ActivityCard(
        title="影子模仿",
        tags=["5分钟", "家里", "不用材料"],
        intro="用手做影子，让孩子模仿，再交换角色。",
        steps=["找一面有光的墙", "你先做一个简单影子", "换孩子来做，你来模仿"],
        question="哪个影子最好笑？",
        record_prompt="孩子今天最有趣的反应是什么？",
        sprite_tip="玩精灵建议：只做3轮就够，不用追求完美。",
    ),
    ActivityCard(
        title="颜色寻宝",
        tags=["10分钟", "家里", "不用材料"],
        intro="一起找出3种颜色的物品，说说最喜欢哪一个。",
        steps=["选一个颜色", "一起找3个同色物品", "让孩子选最喜欢的一个"],
        question="这个颜色让你想到什么？",
        record_prompt="孩子今天喜欢了什么颜色？为什么？",
        sprite_tip="玩精灵建议：少找几个，保持轻松。",
    ),
    ActivityCard(
        title="一分钟夸夸",
        tags=["3分钟", "睡前", "不用材料"],
        intro="你和孩子轮流说一句今天想夸对方的话。",
        steps=["你先夸孩子一句", "孩子也夸你一句", "互相说谢谢"],
        question="今天你最想感谢谁？",
        record_prompt="孩子今天说了哪句话让你想记住？",
        sprite_tip="玩精灵建议：说得简单真实，比说得漂亮更重要。",
    ),
]


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


def _safe_json_loads(text: str) -> dict[str, Any] | None:
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return None
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def recommend_activity(context: ActivityContext) -> ActivityCard:
    client = _get_client()
    api_key, model, _ = _get_ai_settings()
    if client is None or not api_key or not model:
        return random.choice(FALLBACK_ACTIVITIES)

    prompt = f"""
你是一个亲子微活动推荐助手，产品角色叫“玩悟精灵”。请根据当前场景生成 1 个低门槛亲子活动。
当前场景：
- 时间：{context.duration}
- 地点：{context.location}
- 材料：{context.materials}
- 孩子状态：{context.child_state}
- 孩子年龄：{context.child_age or "未知"}

要求：
- 活动必须马上能做。
- 不要像课程教案。
- 步骤最多 3 步。
- 总时长尽量 5-15 分钟。
- 材料越少越好。
- 给出 1 个亲子提问。
- 给出 1 个记录提示。
- 语言简洁、温和、适合手机端。
只输出 JSON，不要输出 Markdown：
{{
  "title": "活动名",
  "tags": ["5分钟", "家里", "不用材料"],
  "intro": "一句话说明怎么玩",
  "steps": ["步骤1", "步骤2", "步骤3"],
  "question": "一个亲子提问",
  "record_prompt": "一个记录提示",
  "sprite_tip": "玩悟精灵的一句话提醒"
}}
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你只输出严格 JSON。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
        )
        content = response.choices[0].message.content or ""
        data = _safe_json_loads(content)
        if data is None:
            return random.choice(FALLBACK_ACTIVITIES)
        return ActivityCard(**data)
    except Exception:
        return random.choice(FALLBACK_ACTIVITIES)


def create_memory(activity_title: str, mood: str, one_line_note: str) -> str:
    clean_note = one_line_note.strip()
    if not clean_note:
        clean_note = "我们完成了这个小活动。"

    client = _get_client()
    api_key, model, _ = _get_ai_settings()
    if client is None or not api_key or not model:
        return (
            f"今天我们一起完成了《{activity_title}》。孩子的状态是“{mood}”。"
            f"{clean_note} 这是一个简单但值得保存的亲子时刻。"
        )

    prompt = f"""
你是“悟精灵”，负责把家长的一句话记录整理成简短、真实、温和的亲子记忆。
活动：{activity_title}
孩子/家长感受：{mood}
家长的一句话记录：{clean_note}

要求：
- 100-180 字。
- 不夸张，不编造具体事实。
- 重点保留真实感受、互动瞬间和可回看的记忆感。
- 不要写成教育评价报告。
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
        return (response.choices[0].message.content or "").strip()
    except Exception:
        return (
            f"今天我们一起完成了《{activity_title}》。孩子的状态是“{mood}”。"
            f"{clean_note} 这是一个简单但值得保存的亲子时刻。"
        )
