import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { syncDefaultSources } from "@/lib/sourceSync";

function isAdmin(req: Request): boolean {
  const token = req.headers.get("x-edit-token") || "";
  return token === getEnv("EDIT_TOKEN");
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const result = await syncDefaultSources(db);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

  const { data, error } = await db
    .from("sources")
    .select("id,name,url,enabled")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ synced: true, added: result.added, items: data || [] });
}
