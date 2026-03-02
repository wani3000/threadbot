import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";

function isAdmin(req: Request): boolean {
  const token = req.headers.get("x-edit-token") || "";
  return token === getEnv("EDIT_TOKEN");
}

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("sources").select("id,name,url,enabled").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { name?: string; url?: string };
  if (!body.url?.startsWith("http")) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("sources")
    .insert({ name: body.name || body.url, url: body.url, enabled: true })
    .select("id,name,url,enabled")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
