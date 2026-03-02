import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";

function validateToken(req: Request): boolean {
  const token = new URL(req.url).searchParams.get("token") || req.headers.get("x-edit-token") || "";
  return token === getEnv("EDIT_TOKEN");
}

export async function GET(req: Request, { params }: { params: { draftDate: string } }) {
  if (!validateToken(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("drafts")
    .select("draft_date,post,status,approved,updated_at,source_json")
    .eq("draft_date", params.draftDate)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: { draftDate: string } }) {
  if (!validateToken(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { post?: string; approved?: boolean };
  if (!body.post || body.post.trim().length < 10) {
    return NextResponse.json({ error: "post is too short" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("drafts")
    .update({
      post: body.post,
      approved: Boolean(body.approved),
      status: body.approved ? "approved" : "edited",
      updated_at: new Date().toISOString(),
    })
    .eq("draft_date", params.draftDate)
    .select("draft_date,post,status,approved,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
