import { parseStringPromise } from "xml2js";
import type { Signal, Source } from "./types";

const RECRUIT_PATH_KEYS = ["/career/apply", "/career/recruit", "/career/recruitment", "/career/job", "/career/open"];

function looksLikeRecruitPath(url: string): boolean {
  const low = url.toLowerCase();
  return RECRUIT_PATH_KEYS.some((key) => low.includes(key));
}

function parseAirline(text: string): string | null {
  const low = text.toLowerCase();
  if (low.includes("koreanair") || low.includes("대한항공")) return "대한항공";
  if (low.includes("asiana") || low.includes("아시아나")) return "아시아나항공";
  return null;
}

export async function collectFromSource(source: Source, sinceIso: string): Promise<Signal[]> {
  const url = new URL(source.url);
  const sitemapUrl = `${url.protocol}//${url.host}/sitemap.xml`;
  const res = await fetch(sitemapUrl, { cache: "no-store" });
  if (!res.ok) return [];

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const rows = parsed?.urlset?.url;
  if (!rows) return [];

  const list = Array.isArray(rows) ? rows : [rows];
  const since = new Date(sinceIso);

  return list
    .map((row: { loc?: string; lastmod?: string }) => {
      const loc = row.loc || "";
      const lastmod = row.lastmod || null;
      const published = lastmod ? new Date(lastmod) : null;
      return { loc, published };
    })
    .filter((row: { loc: string; published: Date | null }) => row.loc.includes("/career/") && looksLikeRecruitPath(row.loc))
    .filter((row: { loc: string; published: Date | null }) => !row.published || row.published >= since)
    .map((row: { loc: string; published: Date | null }) => {
      const pageName = row.loc.split("/").pop() || "apply";
      const title = `공식 채용 페이지 업데이트: ${pageName}`;
      const summary = "공식 채용 페이지가 갱신되었습니다. 모집요강/일정은 원문에서 확인하세요.";
      return {
        source_name: source.name,
        source_url: source.url,
        title,
        link: row.loc,
        published_at: row.published ? row.published.toISOString() : null,
        airline: parseAirline(`${source.name} ${source.url} ${row.loc}`),
        role: row.loc.toLowerCase().includes("cabin") ? "승무원" : null,
        summary,
        confidence: "high" as const,
      };
    });
}

export function dedupeSignals(signals: Signal[]): Signal[] {
  const map = new Map<string, Signal>();
  for (const item of signals) {
    const key = `${item.title.toLowerCase().trim()}|${item.link.toLowerCase().trim()}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()].sort((a, b) => {
    const at = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bt - at;
  });
}

export function ongoingSignals(signals: Signal[]): Signal[] {
  return signals.filter((s) => /채용|모집|승무원|객실|recruit|hiring/i.test(`${s.title} ${s.summary}`));
}
