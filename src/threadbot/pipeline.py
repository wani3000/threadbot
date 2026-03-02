from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import yaml

from .collectors import build_collector, collect_manual_csv, default_since
from .models import HiringSignal


def load_sources(path: Path) -> List[Dict]:
    with path.open("r", encoding="utf-8") as fh:
        payload = yaml.safe_load(fh) or {}
    return payload.get("sources", [])


def run_weekly_collection(
    sources_file: Path, manual_file: Path, output_dir: Path, days: int = 7
) -> Tuple[Path, Path, List[HiringSignal]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    since = default_since(days=days)

    all_items: List[HiringSignal] = []
    for src in load_sources(sources_file):
        name = src.get("name") or src.get("url")
        url = src["url"]
        collector = build_collector(url)
        try:
            items = collector.collect(name, url, since)
            all_items.extend(items)
        except Exception as exc:
            print(f"[warn] source_failed name={name} url={url} error={exc}")

    all_items.extend(collect_manual_csv(manual_file, since))

    unique: Dict[Tuple[str, str], HiringSignal] = {}
    for item in all_items:
        key = (item.title.strip().lower(), item.link.strip().lower())
        if key not in unique:
            unique[key] = item

    result = list(unique.values())
    result.sort(key=lambda x: x.published_at or datetime(1970, 1, 1, tzinfo=timezone.utc), reverse=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = output_dir / f"signals_{stamp}.json"
    md_path = output_dir / f"signals_{stamp}.md"

    with json_path.open("w", encoding="utf-8") as fh:
        json.dump([i.to_dict() for i in result], fh, ensure_ascii=False, indent=2)

    with md_path.open("w", encoding="utf-8") as fh:
        fh.write("# 최근 7일 항공사 취업/채용 신호\n\n")
        for i, item in enumerate(result, start=1):
            when = item.published_at.isoformat() if item.published_at else "unknown"
            fh.write(f"{i}. [{item.title}]({item.link})\n")
            fh.write(f"- source: {item.source_name} ({item.source_url})\n")
            fh.write(f"- published_at: {when}\n")
            fh.write(f"- airline: {item.airline or '-'} / role: {item.role or '-'} / confidence: {item.confidence}\n")
            fh.write(f"- summary: {item.summary}\n\n")

    return json_path, md_path, result
