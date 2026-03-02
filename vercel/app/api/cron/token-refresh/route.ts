import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { getThreadsPublishToken, getThreadsTokenExpiresAt, refreshThreadsLongLivedToken, setThreadsPublishToken } from "@/lib/threadsToken";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return cronUnauthorizedResponse();

  try {
    const db = supabaseAdmin();
    const current = await getThreadsPublishToken(db);
    if (!current) {
      return NextResponse.json({ ok: false, error: "THREADS_PUBLISH_TOKEN이 없습니다." }, { status: 400 });
    }

    const beforeExpiresAt = await getThreadsTokenExpiresAt(db);
    const refreshed = await refreshThreadsLongLivedToken(current);
    if (!refreshed.ok || !refreshed.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          refreshed: false,
          status: refreshed.status,
          result: refreshed.body,
          before_expires_at: beforeExpiresAt,
        },
        { status: 502 },
      );
    }

    await setThreadsPublishToken(db, refreshed.accessToken, refreshed.expiresIn);
    const afterExpiresAt = await getThreadsTokenExpiresAt(db);

    return NextResponse.json({
      ok: true,
      refreshed: true,
      before_expires_at: beforeExpiresAt,
      after_expires_at: afterExpiresAt,
      expires_in: refreshed.expiresIn || null,
    });
  } catch (error) {
    return serverErrorResponse("api/cron/token-refresh GET", error);
  }
}
