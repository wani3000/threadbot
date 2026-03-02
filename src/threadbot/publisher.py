from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests


class PublishError(RuntimeError):
    pass


def publish_to_threads(
    post_text: str,
    output_dir: Path,
    endpoint: Optional[str],
    token: Optional[str],
    dry_run: bool,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_path = output_dir / f"publish_{stamp}.json"

    if dry_run:
        result = {
            "published": False,
            "dry_run": True,
            "message": "THREADS_DRY_RUN=true: 실제 업로드를 건너뜀",
            "post": post_text,
        }
        log_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        return log_path

    if not endpoint or not token:
        raise PublishError("실게시 모드에는 THREADS_PUBLISH_ENDPOINT, THREADS_PUBLISH_TOKEN이 필요합니다.")

    response = requests.post(
        endpoint,
        timeout=20,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"text": post_text},
    )

    if response.status_code >= 400:
        raise PublishError(f"게시 실패: HTTP {response.status_code} {response.text[:300]}")

    result = {
        "published": True,
        "dry_run": False,
        "status_code": response.status_code,
        "response": response.json() if response.text else {},
    }
    log_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return log_path
