import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { notFoundResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { publishThreads } from "@/lib/threads";
import { getThreadsPublishToken, isThreadsTokenError, refreshThreadsLongLivedToken, setThreadsPublishToken } from "@/lib/threadsToken";

function kstDate(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

function kstDayBoundsUtc(dateKst: string): { startUtc: string; endUtc: string } {
  // KST 00:00 is UTC-9h previous day, so we build explicit UTC bounds.
  const start = new Date(`${dateKst}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return unauthorizedResponse();
  }

  const db = supabaseAdmin();
  const today = kstDate();
  const { startUtc, endUtc } = kstDayBoundsUtc(today);

  const { data: draft, error } = await db.from("drafts").select("id,post,draft_date,status").eq("draft_date", today).single();
  if (error || !draft) {
    return notFoundResponse("오늘 게시할 초안이 없습니다.");
  }

  // Hard guard: never publish more than once per KST day.
  const { data: todayPosts, error: postCheckErr } = await db
    .from("posts")
    .select("id,posted_at")
    .gte("posted_at", startUtc)
    .lt("posted_at", endUtc)
    .limit(1);
  if (postCheckErr) {
    return serverErrorResponse("api/cron/post post-check", postCheckErr);
  }
  if ((todayPosts || []).length > 0 || draft.status === "posted") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_posted_today",
      draft_date: today,
    });
  }

  const token = await getThreadsPublishToken(db);
  let publish = await publishThreads(draft.post, token);

  if (!publish.ok && isThreadsTokenError(publish)) {
    const refreshed = await refreshThreadsLongLivedToken(token);
    if (refreshed.ok && refreshed.accessToken) {
      await setThreadsPublishToken(db, refreshed.accessToken, refreshed.expiresIn);
      publish = await publishThreads(draft.post, refreshed.accessToken);
    }
  }

  await db.from("posts").insert({
    draft_id: draft.id,
    post: draft.post,
    publish_result: publish,
  });

  await db.from("drafts").update({ status: publish.ok ? "posted" : "failed", updated_at: new Date().toISOString() }).eq("id", draft.id);

  return NextResponse.json({ ok: publish.ok, status: publish.status, result: publish.body });
}
