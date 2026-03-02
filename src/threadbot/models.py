from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Dict, Optional


@dataclass
class HiringSignal:
    source_name: str
    source_url: str
    title: str
    link: str
    published_at: Optional[datetime]
    airline: Optional[str]
    role: Optional[str]
    summary: str
    confidence: str

    def to_dict(self) -> Dict:
        payload = asdict(self)
        payload["published_at"] = self.published_at.isoformat() if self.published_at else None
        return payload

    @staticmethod
    def from_dict(payload: Dict) -> "HiringSignal":
        published_at = payload.get("published_at")
        return HiringSignal(
            source_name=payload["source_name"],
            source_url=payload["source_url"],
            title=payload["title"],
            link=payload["link"],
            published_at=datetime.fromisoformat(published_at) if published_at else None,
            airline=payload.get("airline"),
            role=payload.get("role"),
            summary=payload.get("summary", ""),
            confidence=payload.get("confidence", "medium"),
        )
