const GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");

export async function publishThreads(postText: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = process.env.THREADS_PUBLISH_TOKEN || "";

  // 1) Create text thread media container
  const createBody = new URLSearchParams({
    media_type: "TEXT",
    text: postText,
  });

  const createRes = await fetch(`${GRAPH_BASE}/me/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: createBody.toString(),
  });

  const createJson = await createRes.json().catch(async () => ({ raw: await createRes.text() }));
  const creationId = (createJson as { id?: string })?.id;

  if (!createRes.ok || !creationId) {
    return {
      ok: false,
      status: createRes.status,
      body: { step: "create", response: createJson },
    };
  }

  // 2) Publish the created container
  const publishBody = new URLSearchParams({ creation_id: creationId });
  const publishRes = await fetch(`${GRAPH_BASE}/me/threads_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: publishBody.toString(),
  });

  const publishJson = await publishRes.json().catch(async () => ({ raw: await publishRes.text() }));
  return {
    ok: publishRes.ok,
    status: publishRes.status,
    body: { step: "publish", response: publishJson },
  };
}
