from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from openai import OpenAI

from .models import HiringSignal


def read_style(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def build_fact_sheet(items: List[HiringSignal], limit: int = 10) -> str:
    lines = []
    for i, item in enumerate(items[:limit], start=1):
        published = item.published_at.isoformat() if item.published_at else "unknown"
        lines.append(
            f"{i}) 제목: {item.title}\n"
            f"   항공사: {item.airline or '-'} / 직무: {item.role or '-'}\n"
            f"   날짜: {published}\n"
            f"   요약: {item.summary}\n"
            f"   링크: {item.link}"
        )
    return "\n".join(lines)


def write_post(
    items: List[HiringSignal],
    style_text: str,
    api_key: Optional[str],
    model: str,
) -> str:
    if not items:
        today = datetime.now().strftime("%Y-%m-%d")
        return f"[{today}] 이번 주 신규 채용 공지 확인 중입니다. 업데이트가 확인되면 바로 정리해드릴게요."

    if not api_key:
        return fallback_post(items)

    client = OpenAI(api_key=api_key)
    facts = build_fact_sheet(items)

    system = (
        "당신은 전직 대한항공 승무원 출신 취업교육 선생님 계정의 콘텐츠 라이터다. "
        "반드시 사실 기반으로만 작성하고, 아래 팩트 시트의 정보만 사용한다. "
        "확인되지 않은 내용, 과장, 추측은 금지한다. "
        "문체는 친근한 코칭 톤으로 작성한다. "
        "형식은 '훅 문장 -> 핵심 포인트 3개(첫 번째/두 번째/세 번째) -> 마지막 체크 문장' 순서로 작성한다. "
        "짧은 문장 위주, 한국어 350~650자, 이모지는 0~2개만 사용한다. "
        "본문 마지막에 출처 링크 1~2개를 반드시 붙인다."
    )
    user = (
        f"[계정 기존 말투 샘플]\n{style_text or '(샘플 없음: 교육자 톤으로 작성)'}\n\n"
        f"[최근 7일 채용 팩트]\n{facts}\n\n"
        "요청: 오늘 업로드할 Threads 게시글 1개를 작성해줘."
    )

    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.5,
    )
    return response.output_text.strip()


def fallback_post(items: List[HiringSignal]) -> str:
    top = items[:3]
    bullets = []
    for item in top:
        bullets.append(f"- {item.title} ({item.link})")
    return (
        "이번 주 승무원/항공사 취업 관련 공지 핵심만 정리해요.\n"
        + "\n".join(bullets)
        + "\n\n지원 일정은 공고 원문에서 꼭 다시 확인하세요."
    )


def save_post(path: Path, post: str, source_json: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "created_at": datetime.utcnow().isoformat() + "Z",
        "source_json": str(source_json),
        "post": post,
    }
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return path
