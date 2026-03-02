"use client";

import { useState } from "react";

type Source = { id?: string; name: string; url: string; enabled: boolean };

export default function SourceManager({ initial }: { initial: Source[] }) {
  const [sources, setSources] = useState(initial);
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");

  async function addSource() {
    setMsg("");
    const res = await fetch("/api/collection/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edit-token": token,
      },
      body: JSON.stringify({ name, url }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "추가 실패");
      return;
    }
    setSources((prev) => [...prev, data]);
    setName("");
    setUrl("");
    setMsg("추가 완료");
  }

  return (
    <div>
      <ul>
        {sources.filter((s) => s.enabled).map((s) => (
          <li key={s.id || `${s.name}-${s.url}`}>{s.name}: {s.url}</li>
        ))}
      </ul>
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <input placeholder="EDIT_TOKEN" value={token} onChange={(e) => setToken(e.target.value)} />
        <input placeholder="소스 이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <button onClick={addSource}>URL 추가하기</button>
        {msg ? <p>{msg}</p> : null}
      </div>
    </div>
  );
}
