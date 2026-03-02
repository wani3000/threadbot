import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import ManualIngestForm from "@/components/ManualIngestForm";

export const dynamic = "force-dynamic";

async function getRecentManual() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("signals")
    .select("created_at,title,summary")
    .eq("source_name", "manual-upload")
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

export default async function UploadPage() {
  const recent = await getRecentManual();

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>정보올리기</h1>
      <p>여러 글을 복사/붙여넣기 후 저장하면 됩니다.</p>
      <p><Link href="/">대시보드로 돌아가기</Link></p>

      <section>
        <h2>직접올린글 저장</h2>
        <ManualIngestForm editToken={process.env.EDIT_TOKEN} />
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>최근 저장된 직접올린글</h2>
        {recent.length === 0 ? <p>아직 없습니다.</p> : (
          <ul>
            {recent.map((r: { created_at: string; title: string; summary: string }) => (
              <li key={`${r.created_at}-${r.title}`} style={{ marginBottom: 12 }}>
                <strong>{new Date(r.created_at).toLocaleString("ko-KR")}</strong>
                <div>{r.title}</div>
                <div style={{ color: "#555" }}>{r.summary.slice(0, 180)}{r.summary.length > 180 ? "..." : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
