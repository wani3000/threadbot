import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getWriteMode, isAdminToken, setWriteMode, type WriteMode } from "@/lib/writeMode";

function getToken(req: Request): string {
  return req.headers.get("x-edit-token") || "";
}

export async function GET() {
  const db = supabaseAdmin();
  const mode = await getWriteMode(db);
  return NextResponse.json({ mode });
}

export async function POST(req: Request) {
  if (!isAdminToken(getToken(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { mode?: WriteMode };
  if (body.mode !== "crawl" && body.mode !== "direct") {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const result = await setWriteMode(db, body.mode);
  if (!result.ok) return NextResponse.json({ error: result.error || "failed" }, { status: 500 });
  return NextResponse.json({ ok: true, mode: body.mode });
}
