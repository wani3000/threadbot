import { NextResponse } from "next/server";
import { baseUrl, getEnv, isAuthorizedCron } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";
import { collectFromSource, collectFromThreadsKeywords, dedupeSignals, prioritizeSignals } from "@/lib/collect";
import { generatePost } from "@/lib/generate";
import { sendDraftEmail } from "@/lib/email";
import { syncDefaultSources } from "@/lib/sourceSync";
import { isOfficialRecruitSource } from "@/lib/sourceClassify";
import type { Signal, Source } from "@/lib/types";

function kstDate(offsetDays = 0): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kstNow.setDate(kstNow.getDate() + offsetDays);
  return kstNow.toISOString().slice(0, 10);
}

function kstWeekday(): number {
  return Number(new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getDay());
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const quick = new URL(req.url).searchParams.get("quick") === "1";

  const db = supabaseAdmin();
  await syncDefaultSources(db);
  const today = kstDate(0);
  const targetDate = kstDate(1);
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: sources, error: sourceErr } = await db
    .from("sources")
    .select("name,url,enabled")
    .eq("enabled", true);
  if (sourceErr) {
    return NextResponse.json({ error: sourceErr.message }, { status: 500 });
  }

  const allSignals: Signal[] = [];
  const sourceList = (sources || []) as Source[];
  const officialWeekday = Number(getEnv("OFFICIAL_SOURCE_WEEKDAY", "1")); // 0=Sun, 1=Mon ...
  const includeOfficialToday = kstWeekday() === officialWeekday;
  const influencerSources = sourceList.filter((s) => !isOfficialRecruitSource(s));
  const officialSources = sourceList.filter((s) => isOfficialRecruitSource(s));
  const baseTargets = includeOfficialToday ? [...influencerSources, ...officialSources] : influencerSources;
  const sourceTargets = quick ? baseTargets.slice(0, 12) : baseTargets;
  const settled = await Promise.allSettled(sourceTargets.map((source) => collectFromSource(source, since.toISOString())));
  for (const s of settled) {
    if (s.status === "fulfilled") allSignals.push(...s.value);
  }
  const keywordSignals = quick
    ? await collectFromThreadsKeywords(since.toISOString(), { maxQueries: 5, pages: 1, limit: 12, minScore: 3 })
    : await collectFromThreadsKeywords(since.toISOString());
  allSignals.push(...keywordSignals);
  const signals = prioritizeSignals(dedupeSignals(allSignals));

  if (signals.length > 0) {
    await db.from("signals").insert(
      signals.map((s) => ({
        ...s,
        signal_date: today,
      })),
    );
  }

  const styleSample = getEnv("STYLE_SAMPLE", "친근한 승무원 취업 코칭 톤");
  const post = await generatePost(signals, styleSample);

  const { data: draftRow, error: draftErr } = await db
    .from("drafts")
    .upsert(
      {
        draft_date: targetDate,
        post,
        source_json: signals,
        status: "pending",
        approved: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "draft_date" },
    )
    .select("id,draft_date")
    .single();

  if (draftErr) {
    return NextResponse.json({ error: draftErr.message }, { status: 500 });
  }

  const editUrl = `${baseUrl()}/edit?date=${targetDate}&token=${encodeURIComponent(getEnv("EDIT_TOKEN"))}`;
  await sendDraftEmail({
    to: getEnv("EMAIL_TO"),
    from: getEnv("EMAIL_FROM"),
    subject: `[ThreadBot] ${targetDate} 09:00 자동게시 예정 초안`,
    post,
    editUrl,
  });

  return NextResponse.json({
    ok: true,
    quick,
    draft: draftRow,
    signals: signals.length,
    sourceSignals: allSignals.length - keywordSignals.length,
    keywordSignals: keywordSignals.length,
    includeOfficialToday,
    officialSources: officialSources.length,
    influencerSources: influencerSources.length,
    targetDate,
    editUrl,
  });
}
