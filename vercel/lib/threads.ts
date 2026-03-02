const GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");

function splitSlides(postText: string): string[] {
  return postText
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function createTextContainer(token: string, text: string, replyToId?: string) {
  const createBody = new URLSearchParams({
    media_type: "TEXT",
    text,
  });
  if (replyToId) createBody.set("reply_to_id", replyToId);

  const createRes = await fetch(`${GRAPH_BASE}/me/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: createBody.toString(),
  });
  const createJson = await createRes.json().catch(async () => ({ raw: await createRes.text() }));
  return { ok: createRes.ok, status: createRes.status, json: createJson };
}

async function publishContainer(token: string, creationId: string) {
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
  return { ok: publishRes.ok, status: publishRes.status, json: publishJson };
}

export async function publishThreads(
  postText: string,
  tokenArg?: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = tokenArg || process.env.THREADS_PUBLISH_TOKEN || "";
  const slides = splitSlides(postText);

  if (slides.length > 1) {
    let replyToId: string | undefined;
    const publishedIds: string[] = [];
    for (let i = 0; i < slides.length; i += 1) {
      const text = slides[i];
      const create = await createTextContainer(token, text, replyToId);
      const creationId = (create.json as { id?: string })?.id;
      if (!create.ok || !creationId) {
        return {
          ok: false,
          status: create.status,
          body: { step: "create_series", index: i, response: create.json },
        };
      }

      const publish = await publishContainer(token, creationId);
      const publishedId = (publish.json as { id?: string })?.id;
      if (!publish.ok || !publishedId) {
        return {
          ok: false,
          status: publish.status,
          body: { step: "publish_series", index: i, response: publish.json },
        };
      }
      publishedIds.push(publishedId);
      replyToId = publishedId;
    }
    return {
      ok: true,
      status: 200,
      body: { step: "publish_series", count: slides.length, ids: publishedIds },
    };
  }

  // Single post fallback
  const create = await createTextContainer(token, postText);
  const createJson = create.json;
  const creationId = (createJson as { id?: string })?.id;

  if (!create.ok || !creationId) {
    return {
      ok: false,
      status: create.status,
      body: { step: "create", response: createJson },
    };
  }

  const publish = await publishContainer(token, creationId);
  const publishJson = publish.json;
  return {
    ok: publish.ok,
    status: publish.status,
    body: { step: "publish", response: publishJson },
  };
}
