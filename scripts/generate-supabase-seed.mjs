import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "src/data/dm-script.json");
const outputPath = resolve(process.argv[3] ?? "supabase/seed.sql");
const data = JSON.parse(readFileSync(inputPath, "utf8"));

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function num(value) {
  return value === null || value === undefined ? "null" : String(Number(value));
}

function bool(value) {
  return value ? "true" : "false";
}

function textArray(values) {
  if (!values?.length) return "array[]::text[]";
  return `array[${values.map(sql).join(", ")}]::text[]`;
}

const lines = [
  "-- Generated from src/data/dm-script.json. Recreate with: pnpm generate:supabase-seed",
  "begin;",
  ""
];

for (const session of data.sessions) {
  lines.push(`insert into public.dm_sessions (id, title, sort_index, is_deleted, created_at, updated_at)
values (${sql(session.id)}::uuid, ${sql(session.title)}, ${num(session.sortIndex)}, ${bool(session.isDeleted)}, ${sql(session.createdAt)}::timestamptz, ${sql(session.updatedAt)}::timestamptz)
on conflict (id) do update set
  title = excluded.title,
  sort_index = excluded.sort_index,
  is_deleted = excluded.is_deleted,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;`);
}

lines.push("");

for (const scene of data.scenes) {
  lines.push(`insert into public.dm_scenes (id, session_id, title, sort_index, plain_text, master_notes, created_at, updated_at)
values (${sql(scene.id)}::uuid, ${sql(scene.sessionId)}::uuid, ${sql(scene.title)}, ${num(scene.sortIndex)}, ${sql(scene.plainText)}, ${sql(scene.masterNotes)}, ${sql(scene.createdAt)}::timestamptz, ${sql(scene.updatedAt)}::timestamptz)
on conflict (id) do update set
  session_id = excluded.session_id,
  title = excluded.title,
  sort_index = excluded.sort_index,
  plain_text = excluded.plain_text,
  master_notes = excluded.master_notes,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;`);
}

lines.push("");

for (const target of data.references) {
  lines.push(`insert into public.dm_reference_targets (
  id, title, type, npc_first_name, npc_last_name, text, external_url, image_path, audio_path,
  external_file_path, shared_session_ids, is_shared_across_all_sessions,
  is_archived_from_deleted_session, archived_session_title, created_at, updated_at
)
values (
  ${sql(target.id)}::uuid, ${sql(target.title)}, ${sql(target.type)}, ${sql(target.npcFirstName)}, ${sql(target.npcLastName)}, ${sql(target.text)},
  ${sql(target.externalUrl)}, ${sql(target.imagePath)}, ${sql(target.audioPath)}, ${sql(target.externalFilePath)},
  ${textArray(target.sharedSessionIds)}, ${bool(target.isSharedAcrossAllSessions)}, ${bool(target.isArchivedFromDeletedSession)},
  ${sql(target.archivedSessionTitle)}, ${sql(target.createdAt)}::timestamptz, ${sql(target.updatedAt)}::timestamptz
)
on conflict (id) do update set
  title = excluded.title,
  type = excluded.type,
  npc_first_name = excluded.npc_first_name,
  npc_last_name = excluded.npc_last_name,
  text = excluded.text,
  external_url = excluded.external_url,
  image_path = excluded.image_path,
  audio_path = excluded.audio_path,
  external_file_path = excluded.external_file_path,
  shared_session_ids = excluded.shared_session_ids,
  is_shared_across_all_sessions = excluded.is_shared_across_all_sessions,
  is_archived_from_deleted_session = excluded.is_archived_from_deleted_session,
  archived_session_title = excluded.archived_session_title,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;`);
}

lines.push("");

for (const ref of data.textReferences) {
  lines.push(`insert into public.dm_text_references (id, scene_id, target_id, action, displayed_text, range_start, range_length, created_at, updated_at)
values (${sql(ref.id)}::uuid, ${sql(ref.sceneId)}::uuid, ${sql(ref.targetId)}::uuid, ${sql(ref.action)}, ${sql(ref.displayedText)}, ${num(ref.rangeStart)}, ${num(ref.rangeLength)}, ${sql(ref.createdAt)}::timestamptz, ${sql(ref.updatedAt)}::timestamptz)
on conflict (id) do update set
  scene_id = excluded.scene_id,
  target_id = excluded.target_id,
  action = excluded.action,
  displayed_text = excluded.displayed_text,
  range_start = excluded.range_start,
  range_length = excluded.range_length,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;`);
}

lines.push("", "commit;", "");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${lines.join("\n")}`, "utf8");

console.log(`Wrote ${outputPath}`);
