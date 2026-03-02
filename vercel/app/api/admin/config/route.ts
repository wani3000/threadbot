import { NextResponse } from "next/server";

function pick(...values: Array<string | undefined>): string {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export async function GET() {
  const supabaseUrl = pick(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
  const publishableKey = pick(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );
  return NextResponse.json({
    supabaseUrl,
    publishableKey,
    ready: Boolean(supabaseUrl && publishableKey),
  });
}
