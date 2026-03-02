import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminToken } from "@/lib/writeMode";

function getToken(req: Request): string {
  return req.headers.get("x-edit-token") || "";
}

function kstDate(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

function splitChunks(raw: string): string[] {
  return raw
    .split(/\n\s*\n+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 20);
}

function titleFrom(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 70 ? `${one.slice(0, 70)}...` : one;
}

export async function GET(req: Request) {
  if (!isAdminToken(getToken(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("signals")
    .select("created_at,title,summary,link")
    .eq("source_name", "manual-upload")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  if (!isAdminToken(getToken(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { text?: string };
  const text = (body.text || "").trim();
  if (text.length < 20) return NextResponse.json({ error: "text too short" }, { status: 400 });

  const chunks = splitChunks(text).slice(0, 200);
  if (chunks.length === 0) return NextResponse.json({ error: "no valid chunks" }, { status: 400 });

  const now = new Date();
  const base = now.getTime();
  const rows = chunks.map((chunk, idx) => ({
    signal_date: kstDate(),
    source_name: "manual-upload",
    source_url: "manual://dashboard-upload",
    title: `직접입력: ${titleFrom(chunk)}`,
    link: `manual://entry/${base}-${idx + 1}`,
    published_at: now.toISOString(),
    airline: null,
    role: /승무원|cabin|flight attendant/i.test(chunk) ? "승무원" : null,
    summary: chunk,
    confidence: "high" as const,
  }));

  const db = supabaseAdmin();
  const { error } = await db.from("signals").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: rows.length });
}
