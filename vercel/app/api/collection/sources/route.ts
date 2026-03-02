import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";

function isAdmin(req: Request): boolean {
  const token = req.headers.get("x-edit-token") || "";
  return token === getEnv("EDIT_TOKEN");
}

function toSourceName(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    return path ? `${host}-${path}` : host;
  } catch {
    return rawUrl;
  }
}

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("sources").select("id,name,url,enabled").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { name?: string; url?: string; urls?: string[] };
  const rawUrls = body.urls?.length ? body.urls : body.url ? [body.url] : [];
  const urls = Array.from(new Set(rawUrls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u))));
  if (urls.length === 0) return NextResponse.json({ error: "invalid url" }, { status: 400 });

  const db = supabaseAdmin();
  const rows = urls.map((url) => ({
    name: urls.length === 1 && body.name?.trim() ? body.name.trim() : toSourceName(url),
    url,
    enabled: true,
  }));

  const { data, error } = await db
    .from("sources")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
    .select("id,name,url,enabled");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ added: data?.length || 0, items: data || [] });
}
