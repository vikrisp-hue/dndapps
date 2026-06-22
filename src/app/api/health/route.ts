import { NextResponse } from "next/server";
import { getLibrary, getSupabaseHealth } from "@/lib/supabase-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [library, supabase] = await Promise.all([getLibrary(), getSupabaseHealth()]);

  return NextResponse.json({
    ok: true,
    dataSource: library.source,
    supabase,
    counts: {
      sessions: library.sessions.length,
      scenes: library.scenes.length,
      references: library.references.length,
      textReferences: library.textReferences.length
    }
  });
}
