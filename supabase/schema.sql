create table if not exists public.dm_sessions (
  id uuid primary key,
  title text not null,
  sort_index double precision not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.dm_scenes (
  id uuid primary key,
  session_id uuid not null references public.dm_sessions(id) on delete cascade,
  title text not null,
  sort_index double precision not null default 0,
  plain_text text not null default '',
  rich_text_html text,
  master_notes text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.dm_reference_targets (
  id uuid primary key,
  title text not null,
  type text not null default 'other',
  npc_first_name text,
  npc_last_name text,
  text text not null default '',
  external_url text,
  image_path text,
  audio_path text,
  external_file_path text,
  shared_session_ids text[] not null default '{}',
  is_shared_across_all_sessions boolean not null default false,
  is_archived_from_deleted_session boolean not null default false,
  archived_session_title text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.dm_text_references (
  id uuid primary key,
  scene_id uuid not null references public.dm_scenes(id) on delete cascade,
  target_id uuid not null references public.dm_reference_targets(id) on delete cascade,
  action text,
  displayed_text text,
  range_start integer,
  range_length integer,
  created_at timestamptz,
  updated_at timestamptz
);

create index if not exists dm_scenes_session_id_idx on public.dm_scenes(session_id);
create index if not exists dm_reference_targets_type_idx on public.dm_reference_targets(type);
create index if not exists dm_text_references_scene_id_idx on public.dm_text_references(scene_id);
create index if not exists dm_text_references_target_id_idx on public.dm_text_references(target_id);

alter table public.dm_sessions enable row level security;
alter table public.dm_scenes enable row level security;
alter table public.dm_reference_targets enable row level security;
alter table public.dm_text_references enable row level security;

drop policy if exists "Public read dm sessions" on public.dm_sessions;
drop policy if exists "Public read dm scenes" on public.dm_scenes;
drop policy if exists "Public read dm reference targets" on public.dm_reference_targets;
drop policy if exists "Public read dm text references" on public.dm_text_references;

create policy "Public read dm sessions" on public.dm_sessions
  for select using (true);

create policy "Public read dm scenes" on public.dm_scenes
  for select using (true);

create policy "Public read dm reference targets" on public.dm_reference_targets
  for select using (true);

create policy "Public read dm text references" on public.dm_text_references
  for select using (true);
