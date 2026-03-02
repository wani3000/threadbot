import { getEnv } from "./env";

const GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");
const TOKEN_URL = "manual://config/threads_publish_token";
const EXPIRES_URL = "manual://config/threads_publish_token_expires_at";

export async function getThreadsPublishToken(db: any): Promise<string> {
  try {
    const { data } = await db.from("sources").select("name").eq("url", TOKEN_URL).maybeSingle();
    const stored = (data?.name || "").trim();
    if (stored) return stored;
  } catch (error) {
    console.error("[getThreadsPublishToken]", error);
  }
  return getEnv("THREADS_PUBLISH_TOKEN", "");
}

export async function getThreadsTokenExpiresAt(db: any): Promise<string | null> {
  try {
    const { data } = await db.from("sources").select("name").eq("url", EXPIRES_URL).maybeSingle();
    const stored = (data?.name || "").trim();
    return stored || null;
  } catch (error) {
    console.error("[getThreadsTokenExpiresAt]", error);
    return null;
  }
}

export async function setThreadsPublishToken(db: any, token: string, expiresInSec?: number) {
  const rows = [
    { name: token, url: TOKEN_URL, enabled: false },
    {
      name: new Date(Date.now() + Math.max(0, Number(expiresInSec || 0)) * 1000).toISOString(),
      url: EXPIRES_URL,
      enabled: false,
    },
  ];
  const { error } = await db.from("sources").upsert(rows, { onConflict: "url" });
  if (error) throw error;
}

export async function refreshThreadsLongLivedToken(currentToken: string): Promise<{
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  status: number;
  body: unknown;
}> {
  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: currentToken,
  });
  const res = await fetch(`${GRAPH_BASE}/refresh_access_token?${params.toString()}`, {
    method: "GET",
  });
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  const accessToken = (json as { access_token?: string })?.access_token;
  const expiresIn = Number((json as { expires_in?: number })?.expires_in || 0);
  return {
    ok: res.ok && Boolean(accessToken),
    accessToken,
    expiresIn,
    status: res.status,
    body: json,
  };
}

export function isThreadsTokenError(result: { body: unknown }): boolean {
  const obj = result.body as
    | { step?: string; response?: { error?: { code?: number; message?: string } } }
    | undefined;
  const code = Number(obj?.response?.error?.code || 0);
  const msg = String(obj?.response?.error?.message || "").toLowerCase();
  return code === 190 || msg.includes("access token");
}
