import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { publishThreads } from "@/lib/threads";

function kstDate(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const today = kstDate();

  const { data: draft, error } = await db.from("drafts").select("id,post,draft_date").eq("draft_date", today).single();
  if (error || !draft) {
    return NextResponse.json({ error: "today draft not found" }, { status: 404 });
  }

  const publish = await publishThreads(draft.post);
  await db.from("posts").insert({
    draft_id: draft.id,
    post: draft.post,
    publish_result: publish,
  });

  await db.from("drafts").update({ status: publish.ok ? "posted" : "failed", updated_at: new Date().toISOString() }).eq("id", draft.id);

  return NextResponse.json({ ok: publish.ok, status: publish.status, result: publish.body });
}
