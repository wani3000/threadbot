"use client";

import { useState } from "react";

export default function ManualIngestForm({ editToken }: { editToken?: string }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/manual/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edit-token": editToken || "",
      },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      return;
    }
    setMsg(`저장 완료: ${data.saved || 0}건`);
    setText("");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        rows={18}
        placeholder={"여러 글을 그냥 붙여넣으세요.\n문단(빈 줄) 단위로 자동 분리 저장됩니다."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={save} disabled={saving}>{saving ? "저장 중..." : "저장하기"}</button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
