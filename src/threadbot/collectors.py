from __future__ import annotations

import csv
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, List, Optional
from urllib.parse import urlparse
from xml.etree import ElementTree

import feedparser
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from .models import HiringSignal

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
AIRLINES = [
    "대한항공",
    "아시아나",
    "진에어",
    "에어부산",
    "제주항공",
    "티웨이",
    "이스타",
    "Air Busan",
    "Korean Air",
    "Asiana",
]
ROLES = ["승무원", "객실", "캐빈", "Cabin Crew", "flight attendant"]


class Collector:
    def collect(self, source_name: str, source_url: str, since: datetime) -> List[HiringSignal]:
        raise NotImplementedError


class NaverBlogCollector(Collector):
    def collect(self, source_name: str, source_url: str, since: datetime) -> List[HiringSignal]:
        blog_id = _extract_naver_blog_id(source_url)
        if not blog_id:
            return []
        feed_url = f"https://rss.blog.naver.com/{blog_id}.xml"
        feed = feedparser.parse(feed_url)
        items: List[HiringSignal] = []
        for entry in feed.entries:
            published = _parse_date(entry.get("published") or entry.get("updated"))
            if published and published < since:
                continue
            title = entry.get("title", "(제목없음)")
            if not _is_hiring_related(title + " " + entry.get("summary", "")):
                continue
            items.append(
                HiringSignal(
                    source_name=source_name,
                    source_url=source_url,
                    title=title,
                    link=entry.get("link", source_url),
                    published_at=published,
                    airline=_guess_airline(title),
                    role=_guess_role(title),
                    summary=_clean_html(entry.get("summary", ""))[:280],
                    confidence="high",
                )
            )
        return items


class RecruiterCollector(Collector):
    def collect(self, source_name: str, source_url: str, since: datetime) -> List[HiringSignal]:
        found: List[HiringSignal] = []
        response = requests.get(source_url, timeout=20, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # 1) Try parsing visible anchors (works on some recruiter pages)
        for anchor in soup.select("a"):
            title = " ".join(anchor.stripped_strings)
            if len(title) < 4 or not _is_hiring_related(title):
                continue
            link = requests.compat.urljoin(source_url, anchor.get("href") or "")
            block = anchor.parent.get_text(" ", strip=True)[:320]
            published = _find_date_in_text(block)
            if published and published < since:
                continue
            found.append(
                HiringSignal(
                    source_name=source_name,
                    source_url=source_url,
                    title=title,
                    link=link,
                    published_at=published,
                    airline=_guess_airline(title + " " + block),
                    role=_guess_role(title + " " + block),
                    summary=block,
                    confidence="high",
                )
            )

        # 2) Fallback: parse sitemap updates for dynamic (Next.js) career pages
        found.extend(_collect_recruiter_sitemap_updates(source_name, source_url, since))
        return _dedupe(found)


class GenericWebCollector(Collector):
    def collect(self, source_name: str, source_url: str, since: datetime) -> List[HiringSignal]:
        # Social profiles often block scraping, so we keep low-confidence stubs unless text is visible.
        try:
            response = requests.get(source_url, timeout=20, headers={"User-Agent": USER_AGENT})
            response.raise_for_status()
        except Exception:
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        found: List[HiringSignal] = []
        for anchor in soup.select("a"):
            title = " ".join(anchor.stripped_strings)
            if len(title) < 8:
                continue
            if not _is_hiring_related(title):
                continue
            link = requests.compat.urljoin(source_url, anchor.get("href") or "")
            text = anchor.parent.get_text(" ", strip=True)[:280]
            published = _find_date_in_text(text)
            if published and published < since:
                continue
            found.append(
                HiringSignal(
                    source_name=source_name,
                    source_url=source_url,
                    title=title,
                    link=link,
                    published_at=published,
                    airline=_guess_airline(title + " " + text),
                    role=_guess_role(title + " " + text),
                    summary=text,
                    confidence="medium",
                )
            )
        return _dedupe(found)


def collect_manual_csv(path: Path, since: datetime) -> List[HiringSignal]:
    if not path.exists():
        return []
    rows: List[HiringSignal] = []
    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            date_value = _parse_date(row.get("published_at"))
            if date_value and date_value < since:
                continue
            title = row.get("title") or "(제목없음)"
            text = f"{title} {row.get('summary', '')}"
            if not _is_hiring_related(text):
                continue
            rows.append(
                HiringSignal(
                    source_name=row.get("source_name", "manual"),
                    source_url=row.get("source_url", "manual"),
                    title=title,
                    link=row.get("link", ""),
                    published_at=date_value,
                    airline=row.get("airline") or _guess_airline(text),
                    role=row.get("role") or _guess_role(text),
                    summary=row.get("summary", ""),
                    confidence=row.get("confidence", "high"),
                )
            )
    return _dedupe(rows)


def build_collector(url: str) -> Collector:
    host = (urlparse(url).hostname or "").lower()
    if "blog.naver.com" in host:
        return NaverBlogCollector()
    if "recruiter.co.kr" in host:
        return RecruiterCollector()
    return GenericWebCollector()


def _extract_naver_blog_id(url: str) -> Optional[str]:
    parsed = urlparse(url)
    if "blog.naver.com" not in (parsed.hostname or ""):
        return None
    path = parsed.path.strip("/")
    return path.split("/")[0] if path else None


def _parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        dt = date_parser.parse(raw)
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _find_date_in_text(text: str) -> Optional[datetime]:
    match = re.search(r"(20\d{2}[./-]\d{1,2}[./-]\d{1,2})", text)
    if not match:
        return None
    try:
        dt = date_parser.parse(match.group(1))
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _clean_html(text: str) -> str:
    return BeautifulSoup(text, "html.parser").get_text(" ", strip=True)


def _is_hiring_related(text: str) -> bool:
    hay = text.lower()
    keywords = ["채용", "모집", "취업", "공채", "지원", "승무원", "면접", "hire", "recruit"]
    return any(k.lower() in hay for k in keywords)


def _guess_airline(text: str) -> Optional[str]:
    for name in AIRLINES:
        if name.lower() in text.lower():
            return name
    return None


def _guess_role(text: str) -> Optional[str]:
    for role in ROLES:
        if role.lower() in text.lower():
            return role
    return None


def _dedupe(items: Iterable[HiringSignal]) -> List[HiringSignal]:
    seen = set()
    out: List[HiringSignal] = []
    for item in items:
        key = (item.title.strip().lower(), item.link.strip().lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    out.sort(key=lambda x: x.published_at or datetime.now(timezone.utc), reverse=True)
    return out


def default_since(days: int = 7) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _collect_recruiter_sitemap_updates(source_name: str, source_url: str, since: datetime) -> List[HiringSignal]:
    parsed = urlparse(source_url)
    sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"
    try:
        res = requests.get(sitemap_url, timeout=20, headers={"User-Agent": USER_AGENT})
        res.raise_for_status()
        root = ElementTree.fromstring(res.text)
    except Exception:
        return []

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    out: List[HiringSignal] = []
    for item in root.findall(".//sm:url", ns):
        loc = (item.findtext("sm:loc", default="", namespaces=ns) or "").strip()
        lastmod_raw = (item.findtext("sm:lastmod", default="", namespaces=ns) or "").strip()
        lastmod = _parse_date(lastmod_raw)

        if not loc or "/career/" not in loc:
            continue
        if not _looks_like_recruitment_path(loc):
            continue
        if lastmod and lastmod < since:
            continue

        path_name = loc.rstrip("/").split("/")[-1]
        title = f"공식 채용 페이지 업데이트: {path_name}"
        summary = "공식 채용 페이지가 최근 갱신되었습니다. 상세 모집 공고와 지원 기간은 원문에서 확인하세요."
        out.append(
            HiringSignal(
                source_name=source_name,
                source_url=source_url,
                title=title,
                link=loc,
                published_at=lastmod,
                airline=_guess_airline(loc + " " + source_name),
                role="승무원" if "cabin" in loc.lower() else None,
                summary=summary,
                confidence="high",
            )
        )
    return out


def _looks_like_recruitment_path(url: str) -> bool:
    low = url.lower()
    keys = [
        "/career/apply",
        "/career/recruit",
        "/career/recruitment",
        "/career/job",
        "/career/open",
    ]
    return any(key in low for key in keys)
