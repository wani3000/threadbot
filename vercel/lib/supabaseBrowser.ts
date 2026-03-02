"use client";

import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;
let cachedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let cachedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
let configLoaded = false;

async function loadRuntimeConfig(): Promise<void> {
  if (configLoaded) return;
  configLoaded = true;
  try {
    const res = await fetch("/api/admin/config", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!cachedUrl) cachedUrl = data?.supabaseUrl || "";
    if (!cachedKey) cachedKey = data?.publishableKey || "";
  } catch (error) {
    console.error("[supabaseBrowser.loadRuntimeConfig]", error);
  }
}

export function getSupabaseBrowserClient() {
  if (client) return client;
  const url = cachedUrl;
  const key = cachedKey;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

export async function getAdminAuthHeader(): Promise<Record<string, string>> {
  if (!getSupabaseBrowserClient()) {
    await loadRuntimeConfig();
  }
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function ensureSupabaseBrowserClient(): Promise<boolean> {
  if (getSupabaseBrowserClient()) return true;
  await loadRuntimeConfig();
  return Boolean(getSupabaseBrowserClient());
}
