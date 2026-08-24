-- MUSIC FLOW cloud schema (multi-user, RLS)
-- Apply in Supabase SQL Editor if CLI/MCP migration fails.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.artists (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.albums (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist_id bigint references public.artists(id) on delete set null,
  year int,
  genre text,
  cover_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  filename text not null,
  artist_id bigint references public.artists(id) on delete set null,
  album_id bigint references public.albums(id) on delete set null,
  genre text,
  year int,
  track_number int,
  disc_number int,
  duration double precision not null default 0,
  bitrate int,
  sample_rate int,
  cover_path text,
  storage_path text not null,
  file_size bigint,
  is_favorite boolean not null default false,
  play_count int not null default 0,
  last_played_at timestamptz,
  last_position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracks_user_id_idx on public.tracks(user_id);
create index if not exists tracks_user_favorite_idx on public.tracks(user_id, is_favorite);
create index if not exists tracks_user_last_played_idx on public.tracks(user_id, last_played_at desc nulls last);
create index if not exists tracks_user_created_idx on public.tracks(user_id, created_at desc);

create table if not exists public.playlists (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  cover_path text,
  is_system boolean not null default false,
  system_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, system_key)
);

create table if not exists public.playlist_tracks (
  id bigserial primary key,
  playlist_id bigint not null references public.playlists(id) on delete cascade,
  track_id bigint not null references public.tracks(id) on delete cascade,
  position int not null default 0,
  unique (playlist_id, track_id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.playback_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.playlists (user_id, name, is_system, system_key)
  values
    (new.id, 'お気に入り', true, 'favorites'),
    (new.id, '最近再生した曲', true, 'recent')
  on conflict do nothing;

  insert into public.user_settings (user_id, settings)
  values (new.id, '{}'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.user_settings enable row level security;
alter table public.playback_snapshots enable row level security;

drop policy if exists "profiles_own" on public.profiles;
drop policy if exists "artists_own" on public.artists;
drop policy if exists "albums_own" on public.albums;
drop policy if exists "tracks_own" on public.tracks;
drop policy if exists "playlists_own" on public.playlists;
drop policy if exists "playlist_tracks_own" on public.playlist_tracks;
drop policy if exists "settings_own" on public.user_settings;
drop policy if exists "snapshots_own" on public.playback_snapshots;
drop policy if exists "audio_own_rw" on storage.objects;
drop policy if exists "covers_own_rw" on storage.objects;

create policy "profiles_own" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "artists_own" on public.artists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "albums_own" on public.albums for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tracks_own" on public.tracks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "playlists_own" on public.playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "playlist_tracks_own" on public.playlist_tracks for all
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));
create policy "settings_own" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "snapshots_own" on public.playback_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('audio', 'audio', false, 104857600),
  ('covers', 'covers', false, 10485760)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy "audio_own_rw" on storage.objects for all
  using (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "covers_own_rw" on storage.objects for all
  using (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);
