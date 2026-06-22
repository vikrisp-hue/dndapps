import { LibraryClient } from "@/components/LibraryClient";
import { getLibrary, getSupabaseHealth } from "@/lib/supabase-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [library, health] = await Promise.all([getLibrary(), getSupabaseHealth()]);

  return <LibraryClient library={library} supabaseStatus={health.status} />;
}
