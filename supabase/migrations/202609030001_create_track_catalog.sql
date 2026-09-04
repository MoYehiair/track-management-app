create extension if not exists pgcrypto;

create type public.track_status as enum ('draft', 'submitted', 'distributed');
create type public.distribution_status as enum ('pending', 'live', 'rejected');

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  country text not null check (char_length(trim(country)) between 2 and 80),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  artist_id uuid not null,
  isrc text not null unique check (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
  release_date date not null,
  genre text not null check (char_length(trim(genre)) between 1 and 80),
  status public.track_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracks_artist_id_fkey foreign key (artist_id) references public.artists(id) on delete restrict
);

create table public.dsps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.track_distributions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null,
  dsp_id uuid not null,
  submitted_at timestamptz not null default now(),
  status public.distribution_status not null default 'pending',
  updated_at timestamptz not null default now(),
  constraint track_distributions_track_id_fkey foreign key (track_id) references public.tracks(id) on delete cascade,
  constraint track_distributions_dsp_id_fkey foreign key (dsp_id) references public.dsps(id) on delete restrict,
  constraint track_distributions_track_dsp_key unique (track_id, dsp_id)
);

create index tracks_artist_id_idx on public.tracks (artist_id);
create index tracks_status_idx on public.tracks (status);
create index tracks_genre_idx on public.tracks (genre);
create index track_distributions_track_id_idx on public.track_distributions (track_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger artists_set_updated_at before update on public.artists
for each row execute function public.set_updated_at();
create trigger tracks_set_updated_at before update on public.tracks
for each row execute function public.set_updated_at();
create trigger track_distributions_set_updated_at before update on public.track_distributions
for each row execute function public.set_updated_at();

alter table public.artists enable row level security;
alter table public.tracks enable row level security;
alter table public.dsps enable row level security;
alter table public.track_distributions enable row level security;

-- The catalog is intentionally readable. Write policies remain owner-scoped and operation-specific.
create policy "artists_catalog_read" on public.artists
for select to anon, authenticated using (id is not null);
create policy "artists_authenticated_create" on public.artists
for insert to authenticated with check (created_by = (select auth.uid()));
create policy "artists_owner_update" on public.artists
for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "artists_owner_delete" on public.artists
for delete to authenticated using (created_by = (select auth.uid()));

create policy "tracks_catalog_read" on public.tracks
for select to anon, authenticated using (id is not null);
create policy "tracks_authenticated_create" on public.tracks
for insert to authenticated with check (created_by = (select auth.uid()));
create policy "tracks_owner_update" on public.tracks
for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "tracks_owner_delete_drafts" on public.tracks
for delete to authenticated using (created_by = (select auth.uid()) and status = 'draft');

create policy "active_dsps_catalog_read" on public.dsps
for select to anon, authenticated using (is_active = true);

create policy "distribution_catalog_read" on public.track_distributions
for select to anon, authenticated using (id is not null);

-- No client insert/update/delete policy exists for DSPs or distributions. Those writes are server-only.
grant select on public.artists, public.tracks, public.dsps, public.track_distributions to anon, authenticated;
grant insert, update, delete on public.artists, public.tracks to authenticated;
revoke insert, update, delete on public.dsps from anon, authenticated;
revoke insert, update, delete on public.track_distributions from anon, authenticated;
