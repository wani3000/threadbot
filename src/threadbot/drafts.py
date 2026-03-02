from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def kst_now() -> datetime:
    return datetime.now(KST)


def today_key() -> str:
    return kst_now().strftime("%Y-%m-%d")


def draft_path_for_today(output_dir: Path) -> Path:
    return output_dir / f"draft_{today_key()}.json"


def save_today_draft(output_dir: Path, post_text: str, source_json: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = draft_path_for_today(output_dir)
    payload = {
        "date": today_key(),
        "created_at": kst_now().isoformat(),
        "updated_at": kst_now().isoformat(),
        "status": "pending",
        "approved": False,
        "source_json": source_json,
        "post": post_text,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_draft(path: Path) -> Optional[Dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def list_drafts(output_dir: Path) -> List[Path]:
    return sorted(output_dir.glob("draft_*.json"), reverse=True)


def load_today_draft(output_dir: Path) -> Optional[Dict]:
    return load_draft(draft_path_for_today(output_dir))


def update_draft(path: Path, post_text: str, approved: Optional[bool] = None) -> Optional[Dict]:
    payload = load_draft(path)
    if not payload:
        return None
    payload["post"] = post_text
    payload["updated_at"] = kst_now().isoformat()
    payload["status"] = "edited"
    if approved is not None:
        payload["approved"] = approved
        if approved:
            payload["approved_at"] = kst_now().isoformat()
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
