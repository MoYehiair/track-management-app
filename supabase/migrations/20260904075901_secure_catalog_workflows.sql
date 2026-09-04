-- Tighten Data API exposure. Public users only receive catalog-safe columns.
revoke select on public.artists, public.tracks, public.dsps, public.track_distributions from anon, authenticated;

grant select (id, name, country) on public.artists to anon, authenticated;
grant select (email) on public.artists to authenticated;
grant select (id, title, artist_id, isrc, release_date, genre, status) on public.tracks to anon, authenticated;
grant select (id, name) on public.dsps to anon, authenticated;
grant select (id, track_id, dsp_id, submitted_at, status) on public.track_distributions to anon, authenticated;

-- Status transitions go through the checked RPC below, never a raw table update.
revoke update on public.tracks from authenticated;
drop policy if exists "tracks_owner_update" on public.tracks;

create or replace function public.update_track_status(
  p_track_id uuid,
  p_status public.track_status
)
returns table (id uuid, status public.track_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_track
  from public.tracks as t
  where t.id = p_track_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRACK_NOT_FOUND';
  end if;

  if v_track.created_by is null or v_track.created_by <> v_user_id then
    raise exception using errcode = '42501', message = 'TRACK_NOT_OWNED';
  end if;

  if not (
    (v_track.status = 'draft' and p_status = 'submitted') or
    (v_track.status = 'submitted' and p_status = 'distributed')
  ) then
    raise exception using errcode = '23514', message = 'INVALID_STATUS_TRANSITION';
  end if;

  if p_status = 'distributed' and not exists (
    select 1 from public.track_distributions as td
    where td.track_id = p_track_id and td.status = 'live'
  ) then
    raise exception using errcode = '23514', message = 'LIVE_DISTRIBUTION_REQUIRED';
  end if;

  return query
  update public.tracks as t
  set status = p_status
  where t.id = p_track_id
  returning t.id, t.status;
end;
$$;

revoke all on function public.update_track_status(uuid, public.track_status) from public, anon;
grant execute on function public.update_track_status(uuid, public.track_status) to authenticated;

-- This RPC locks the track and commits DSP rows plus status as one transaction.
create or replace function public.submit_track_distributions(
  p_track_id uuid,
  p_dsp_ids uuid[],
  p_user_id uuid
)
returns setof public.track_distributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks%rowtype;
  v_dsp_count integer;
begin
  if p_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if coalesce(cardinality(p_dsp_ids), 0) < 1 or cardinality(p_dsp_ids) > 20 then
    raise exception using errcode = '22023', message = 'INVALID_DSP_COUNT';
  end if;

  if (select count(distinct requested.dsp_id) from unnest(p_dsp_ids) as requested(dsp_id)) <> cardinality(p_dsp_ids) then
    raise exception using errcode = '22023', message = 'DUPLICATE_DSP_IDS';
  end if;

  select * into v_track
  from public.tracks as t
  where t.id = p_track_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRACK_NOT_FOUND';
  end if;

  if v_track.created_by is null or v_track.created_by <> p_user_id then
    raise exception using errcode = '42501', message = 'TRACK_NOT_OWNED';
  end if;

  if v_track.status = 'distributed' then
    raise exception using errcode = '23514', message = 'TRACK_ALREADY_DISTRIBUTED';
  end if;

  select count(*) into v_dsp_count
  from public.dsps as d
  where d.id = any(p_dsp_ids) and d.is_active = true;

  if v_dsp_count <> cardinality(p_dsp_ids) then
    raise exception using errcode = '22023', message = 'DSP_NOT_FOUND_OR_INACTIVE';
  end if;

  insert into public.track_distributions (track_id, dsp_id, status)
  select p_track_id, requested.dsp_id, 'pending'::public.distribution_status
  from unnest(p_dsp_ids) as requested(dsp_id)
  on conflict (track_id, dsp_id) do nothing;

  update public.tracks as t
  set status = 'submitted'
  where t.id = p_track_id;

  return query
  select td.*
  from public.track_distributions as td
  where td.track_id = p_track_id and td.dsp_id = any(p_dsp_ids)
  order by td.submitted_at;
end;
$$;

revoke all on function public.submit_track_distributions(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.submit_track_distributions(uuid, uuid[], uuid) to service_role;

-- The Edge Function no longer needs direct CRUD privileges.
revoke all privileges on public.artists, public.tracks, public.dsps, public.track_distributions from service_role;
