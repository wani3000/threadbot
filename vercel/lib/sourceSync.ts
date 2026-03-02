import { DEFAULT_SOURCES } from "./defaultSources";

export async function syncDefaultSources(db: any): Promise<{ added: number; error?: string }> {
  const { data, error } = await db
    .from("sources")
    .upsert(DEFAULT_SOURCES, { onConflict: "url", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return { added: 0, error: error.message };
  }
  return { added: data?.length || 0 };
}
