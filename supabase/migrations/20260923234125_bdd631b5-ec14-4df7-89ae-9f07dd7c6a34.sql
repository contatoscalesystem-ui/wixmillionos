-- ===== Staging rows for smart import =====
create table public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  parsed_data jsonb not null default '{}'::jsonb,
  status text not null default 'valid' check (status in ('valid','review','duplicate','invalid')),
  warnings jsonb not null default '[]'::jsonb,
  duplicate_matches jsonb not null default '[]'::jsonb,
  selected_for_import boolean not null default true,
  duplicate_action text check (duplicate_action in ('skip','import_anyway')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.import_batch_rows to authenticated;
grant all on public.import_batch_rows to service_role;
alter table public.import_batch_rows enable row level security;
create policy "members read batch rows" on public.import_batch_rows for select to authenticated using (workspace_id = public.current_workspace_id());
create policy "members create batch rows" on public.import_batch_rows for insert to authenticated
  with check (workspace_id = public.current_workspace_id()
    and exists (select 1 from public.import_batches b where b.id = import_batch_id and b.workspace_id = public.current_workspace_id()));
create policy "members update batch rows" on public.import_batch_rows for update to authenticated
  using (workspace_id = public.current_workspace_id()) with check (workspace_id = public.current_workspace_id());
-- members may clear staging rows only for batches that never completed
create policy "members delete staging rows" on public.import_batch_rows for delete to authenticated
  using (workspace_id = public.current_workspace_id()
    and exists (select 1 from public.import_batches b where b.id = import_batch_id and b.status <> 'completed'));
create policy "admins delete batch rows" on public.import_batch_rows for delete to authenticated
  using (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'));
create index import_batch_rows_batch_idx on public.import_batch_rows (import_batch_id, row_number);
create trigger t_import_batch_rows_updated before update on public.import_batch_rows for each row execute function public.update_updated_at_column();

-- ===== Commit import (atomic) =====
create or replace function public.commit_import_batch(_batch_id uuid, _assigned_to uuid default null, _initial_status public.lead_status default 'novo')
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  _ws uuid := public.current_workspace_id();
  _b public.import_batches%rowtype;
  _g public.garimpos%rowtype;
  _assignee uuid;
  _imported int; _total int; _valid int; _invalid int; _dups int; _review int;
begin
  if auth.uid() is null or _ws is null then raise exception 'NOT_AUTHORIZED'; end if;
  if _initial_status not in ('novo','pronto_contato') then raise exception 'INVALID_INITIAL_STATUS'; end if;
  select * into _b from public.import_batches where id = _batch_id and workspace_id = _ws for update;
  if not found then raise exception 'BATCH_NOT_FOUND'; end if;
  if _b.status not in ('preview','ready','failed') then raise exception 'BATCH_NOT_READY'; end if;
  _assignee := coalesce(_assigned_to, auth.uid());
  if not exists (select 1 from public.user_roles r where r.user_id = _assignee and r.workspace_id = _ws) then
    raise exception 'ASSIGNEE_NOT_MEMBER';
  end if;
  select * into _g from public.garimpos where id = _b.garimpo_id and workspace_id = _ws;

  update public.import_batches set status = 'importing' where id = _batch_id;

  with src as (
    select r.* from public.import_batch_rows r
    where r.import_batch_id = _batch_id and r.workspace_id = _ws
      and r.selected_for_import and r.status <> 'invalid'
      and (r.status <> 'duplicate' or r.duplicate_action = 'import_anyway')
      and nullif(trim(r.parsed_data->>'company_name'),'') is not null
  ), ins as (
    insert into public.leads (
      workspace_id, garimpo_id, import_batch_id, imported_at, imported_by, assigned_to, status,
      company_name, niche, city, state, neighborhood, address, phone, whatsapp, whatsapp_confirmed,
      instagram_url, instagram_followers, google_maps_url, google_rating, google_reviews,
      website_url, website_status, scheduling_type, scheduling_url, digital_presence, photo_quality,
      score, priority, position, commercial_observation, raw_source_data
    )
    select _ws, _b.garimpo_id, _batch_id, now(), auth.uid(), _assignee, _initial_status,
      trim(p->>'company_name'),
      coalesce(nullif(p->>'niche',''), _g.niche),
      coalesce(nullif(p->>'city',''), _g.city),
      coalesce(nullif(p->>'state',''), _g.state),
      nullif(p->>'neighborhood',''), nullif(p->>'address',''),
      nullif(p->>'phone',''), nullif(p->>'whatsapp',''),
      coalesce((p->>'whatsapp_confirmed')::boolean, false),
      nullif(p->>'instagram_url',''), nullif(p->>'instagram_followers','')::int,
      nullif(p->>'google_maps_url',''), nullif(p->>'google_rating','')::numeric, nullif(p->>'google_reviews','')::int,
      nullif(p->>'website_url',''), coalesce(nullif(p->>'website_status','')::public.website_status, 'nao_confirmado'),
      nullif(p->>'scheduling_type',''), nullif(p->>'scheduling_url',''),
      nullif(p->>'digital_presence',''), nullif(p->>'photo_quality',''),
      nullif(p->>'score','')::int, nullif(p->>'priority','')::public.lead_priority, nullif(p->>'position','')::int,
      nullif(p->>'commercial_observation',''),
      jsonb_build_object('raw_row', s.raw_data, 'parsed_fields', s.parsed_data, 'warnings', s.warnings,
        'source_batch_id', _batch_id, 'row_number', s.row_number, 'parser_version', 'mvp2-v1')
    from (select src.*, src.parsed_data as p from src) s
    returning id
  )
  select count(*) into _imported from ins;

  select count(*), count(*) filter (where status = 'valid'), count(*) filter (where status = 'invalid'),
         count(*) filter (where status = 'duplicate'), count(*) filter (where status = 'review')
    into _total, _valid, _invalid, _dups, _review
    from public.import_batch_rows where import_batch_id = _batch_id;

  update public.import_batches set status = 'completed', completed_at = now(), imported_rows = _imported,
    total_rows = _total, valid_rows = _valid, invalid_rows = _invalid, duplicate_rows = _dups
  where id = _batch_id;

  if _b.garimpo_id is not null then
    update public.garimpos set status = 'ativo' where id = _b.garimpo_id;
  end if;

  insert into public.lead_activities (workspace_id, lead_id, activity_type, description, metadata)
  values (_ws, null, 'import_completed',
    _imported || ' leads importados pelo garimpo ' || coalesce(_g.name, '—') || '.',
    jsonb_build_object('import_batch_id', _batch_id, 'garimpo_id', _b.garimpo_id, 'imported', _imported));

  return jsonb_build_object('imported', _imported, 'total', _total, 'valid', _valid, 'invalid', _invalid, 'duplicates', _dups, 'review', _review);
end; $$;
revoke execute on function public.commit_import_batch(uuid, uuid, public.lead_status) from public, anon;
grant execute on function public.commit_import_batch(uuid, uuid, public.lead_status) to authenticated;

-- ===== Storage policies for original report files =====
create policy "members read import files" on storage.objects for select to authenticated
  using (bucket_id = 'garimpo-imports' and (storage.foldername(name))[1] = public.current_workspace_id()::text);
create policy "members upload import files" on storage.objects for insert to authenticated
  with check (bucket_id = 'garimpo-imports' and (storage.foldername(name))[1] = public.current_workspace_id()::text);
create policy "admins delete import files" on storage.objects for delete to authenticated
  using (bucket_id = 'garimpo-imports' and (storage.foldername(name))[1] = public.current_workspace_id()::text and public.has_role(auth.uid(), 'admin'));