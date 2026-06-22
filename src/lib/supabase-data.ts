import { createClient } from "@supabase/supabase-js";
import type { DmLibrary, DmReferenceTarget, DmScene, DmSession, DmTextReference } from "@/types/dm";
import { getLocalLibrary } from "@/lib/local-data";

type SupabaseStatus = "not-configured" | "connected" | "tables-missing" | "empty" | "error";

type SupabaseHealth = {
  status: SupabaseStatus;
  message: string;
};

function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY
  };
}

function getServerClient() {
  const { url, secretKey } = getSupabaseConfig();
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function camelSession(row: Record<string, unknown>): DmSession {
  return {
    id: String(row.id),
    title: String(row.title ?? "Без названия"),
    sortIndex: Number(row.sort_index ?? 0),
    isDeleted: Boolean(row.is_deleted),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
  };
}

function camelScene(row: Record<string, unknown>): DmScene {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    title: String(row.title ?? "Без названия"),
    sortIndex: Number(row.sort_index ?? 0),
    plainText: String(row.plain_text ?? ""),
    masterNotes: typeof row.master_notes === "string" ? row.master_notes : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
  };
}

function camelReference(row: Record<string, unknown>): DmReferenceTarget {
  return {
    id: String(row.id),
    title: String(row.title ?? "Без названия"),
    type: String(row.type ?? "other"),
    npcFirstName: typeof row.npc_first_name === "string" ? row.npc_first_name : null,
    npcLastName: typeof row.npc_last_name === "string" ? row.npc_last_name : null,
    text: String(row.text ?? ""),
    externalUrl: typeof row.external_url === "string" ? row.external_url : null,
    imagePath: typeof row.image_path === "string" ? row.image_path : null,
    audioPath: typeof row.audio_path === "string" ? row.audio_path : null,
    externalFilePath: typeof row.external_file_path === "string" ? row.external_file_path : null,
    sharedSessionIds: Array.isArray(row.shared_session_ids) ? row.shared_session_ids.map(String) : [],
    isSharedAcrossAllSessions: Boolean(row.is_shared_across_all_sessions),
    isArchivedFromDeletedSession: Boolean(row.is_archived_from_deleted_session),
    archivedSessionTitle: typeof row.archived_session_title === "string" ? row.archived_session_title : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
  };
}

function camelTextReference(row: Record<string, unknown>): DmTextReference {
  return {
    id: String(row.id),
    sceneId: String(row.scene_id),
    targetId: String(row.target_id),
    action: typeof row.action === "string" ? row.action : null,
    displayedText: typeof row.displayed_text === "string" ? row.displayed_text : null,
    rangeStart: row.range_start === null || row.range_start === undefined ? null : Number(row.range_start),
    rangeLength: row.range_length === null || row.range_length === undefined ? null : Number(row.range_length),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
  };
}

function isMissingTableError(message: string) {
  return /does not exist|schema cache|could not find|PGRST205/i.test(message);
}

export async function getSupabaseHealth(): Promise<SupabaseHealth> {
  const client = getServerClient();
  if (!client) {
    return { status: "not-configured", message: "Supabase env is not configured." };
  }

  const { data, error } = await client.from("dm_sessions").select("id").limit(1);
  if (!error) {
    return data?.length
      ? { status: "connected", message: "Supabase tables contain campaign data." }
      : { status: "empty", message: "Supabase tables are reachable but empty." };
  }

  const message = error.message || "Supabase request failed.";
  if (isMissingTableError(message)) {
    return { status: "tables-missing", message };
  }

  return { status: "error", message };
}

export async function getLibrary(): Promise<DmLibrary> {
  const client = getServerClient();
  if (!client) return getLocalLibrary();

  try {
    const [sessionsResult, scenesResult, referencesResult, textReferencesResult] = await Promise.all([
      client.from("dm_sessions").select("*").order("sort_index", { ascending: true }).order("created_at", { ascending: true }),
      client.from("dm_scenes").select("*").order("sort_index", { ascending: true }).order("created_at", { ascending: true }),
      client.from("dm_reference_targets").select("*").order("title", { ascending: true }),
      client.from("dm_text_references").select("*").order("created_at", { ascending: true })
    ]);

    const firstError = [sessionsResult, scenesResult, referencesResult, textReferencesResult].find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const sessions = (sessionsResult.data ?? []).map(camelSession);
    const scenes = (scenesResult.data ?? []).map(camelScene);
    const references = (referencesResult.data ?? []).map(camelReference);
    const textReferences = (textReferencesResult.data ?? []).map(camelTextReference);

    if (!sessions.length && !scenes.length && !references.length) {
      return getLocalLibrary();
    }

    return {
      sessions,
      scenes,
      references,
      textReferences,
      source: "supabase"
    };
  } catch {
    return getLocalLibrary();
  }
}
