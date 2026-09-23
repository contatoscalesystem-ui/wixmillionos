-- ===== Workspace access: only users with a role row belong to a workspace =====
create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.workspace_id from public.profiles p
  where p.id = auth.uid()
    and exists (select 1 from public.user_roles r where r.user_id = p.id and r.workspace_id = p.workspace_id)
$$;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id and p.workspace_id = r.workspace_id
    where r.user_id = _user_id and r.role = _role
  )
$$;

-- ===== Invites =====
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  email text not null,
  role app_role not null default 'operador',
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid default auth.uid(),
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspace_invites to authenticated;
grant all on public.workspace_invites to service_role;
alter table public.workspace_invites enable row level security;
create policy "admins manage invites" on public.workspace_invites for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'))
  with check (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'));
create unique index workspace_invites_pending_email_key on public.workspace_invites (workspace_id, lower(email)) where status = 'pending';
create trigger t_upd before update on public.workspace_invites for each row execute function public.update_updated_at_column();

create or replace function public.normalize_invite_email()
returns trigger language plpgsql set search_path = public as $$
begin new.email := lower(trim(new.email)); return new; end $$;
create trigger t_invite_email before insert or update on public.workspace_invites for each row execute function public.normalize_invite_email();

-- Sign-up: first user becomes admin; afterwards only invited e-mails may register.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ws uuid := '00000000-0000-0000-0000-000000000001'; inv public.workspace_invites;
begin
  if not exists (select 1 from public.user_roles where workspace_id = ws and role = 'admin') then
    insert into public.profiles (id, workspace_id, full_name, email, avatar_url)
    values (new.id, ws, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url');
    insert into public.user_roles (user_id, workspace_id, role) values (new.id, ws, 'admin');
    return new;
  end if;
  select * into inv from public.workspace_invites where email = lower(new.email) and status = 'pending' order by created_at desc limit 1 for update;
  if inv.id is null then
    raise exception 'SIGNUP_INVITE_ONLY';
  end if;
  insert into public.profiles (id, workspace_id, full_name, email, avatar_url)
  values (new.id, inv.workspace_id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, workspace_id, role) values (new.id, inv.workspace_id, inv.role);
  update public.workspace_invites set status = 'accepted', accepted_by = new.id, accepted_at = now() where id = inv.id;
  return new;
end $$;

-- Existing account (e.g. removed member) accepts a new pending invite after signing in.
create or replace function public.accept_pending_invite()
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; inv public.workspace_invites;
begin
  if uid is null then return false; end if;
  select lower(email) into em from auth.users where id = uid;
  select * into inv from public.workspace_invites where email = em and status = 'pending' order by created_at desc limit 1 for update;
  if inv.id is null then return false; end if;
  insert into public.profiles (id, workspace_id, email) values (uid, inv.workspace_id, em)
    on conflict (id) do update set workspace_id = excluded.workspace_id;
  if not exists (select 1 from public.user_roles where user_id = uid and workspace_id = inv.workspace_id and role = inv.role) then
    insert into public.user_roles (user_id, workspace_id, role) values (uid, inv.workspace_id, inv.role);
  end if;
  update public.workspace_invites set status = 'accepted', accepted_by = uid, accepted_at = now() where id = inv.id;
  return true;
end $$;

-- Public: is self sign-up still open (no admin yet)?
create or replace function public.signup_open()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.user_roles where workspace_id = '00000000-0000-0000-0000-000000000001' and role = 'admin')
$$;

-- Never leave the workspace without an admin.
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.user_roles where workspace_id = old.workspace_id and role = 'admin' and id <> old.id
  ) then raise exception 'LAST_ADMIN'; end if;
  return old;
end $$;
create trigger t_protect_last_admin before delete on public.user_roles for each row execute function public.protect_last_admin();

revoke execute on function public.accept_pending_invite() from public, anon;
grant execute on function public.accept_pending_invite() to authenticated;
revoke execute on function public.signup_open() from public;
grant execute on function public.signup_open() to anon, authenticated;
revoke execute on function public.protect_last_admin() from public, anon, authenticated;
revoke execute on function public.normalize_invite_email() from public, anon, authenticated;

-- ===== Critical config: templates writable by admins only =====
drop policy "workspace members access" on public.message_templates;
create policy "members read templates" on public.message_templates for select to authenticated using (workspace_id = public.current_workspace_id());
create policy "admins write templates" on public.message_templates for all to authenticated
  using (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'))
  with check (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'));

-- ===== Import batches (MVP 2 structure) =====
create type public.import_batch_status as enum ('uploaded','processing','preview','ready','importing','completed','failed','cancelled');
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  garimpo_id uuid references public.garimpos(id) on delete set null,
  file_name text,
  file_url text,
  file_type text,
  status public.import_batch_status not null default 'uploaded',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  imported_rows integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select, insert, update, delete on public.import_batches to authenticated;
grant all on public.import_batches to service_role;
alter table public.import_batches enable row level security;
create policy "members read batches" on public.import_batches for select to authenticated using (workspace_id = public.current_workspace_id());
create policy "members create batches" on public.import_batches for insert to authenticated with check (workspace_id = public.current_workspace_id());
create policy "members update batches" on public.import_batches for update to authenticated using (workspace_id = public.current_workspace_id()) with check (workspace_id = public.current_workspace_id());
create policy "admins delete batches" on public.import_batches for delete to authenticated using (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'));
create index import_batches_workspace_idx on public.import_batches (workspace_id, created_at desc);
create index import_batches_garimpo_idx on public.import_batches (garimpo_id);

-- ===== Leads: archive + import lineage =====
alter table public.leads
  add column archived_at timestamptz,
  add column archived_by uuid,
  add column import_batch_id uuid references public.import_batches(id),
  add column imported_at timestamptz,
  add column imported_by uuid;

drop policy "workspace members access" on public.leads;
create policy "members read leads" on public.leads for select to authenticated using (workspace_id = public.current_workspace_id());
create policy "members create leads" on public.leads for insert to authenticated with check (workspace_id = public.current_workspace_id());
create policy "members update leads" on public.leads for update to authenticated using (workspace_id = public.current_workspace_id()) with check (workspace_id = public.current_workspace_id());
create policy "admins delete leads" on public.leads for delete to authenticated using (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(), 'admin'));

-- ===== Safe conversion (single transaction, RLS applies) =====
create or replace function public.convert_lead_to_client(_lead_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare l public.leads; cid uuid; created boolean := false;
begin
  select * into l from public.leads where id = _lead_id for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  select id into cid from public.clients where lead_id = _lead_id;
  if cid is null then
    insert into public.clients (workspace_id, lead_id, company_name, phone, whatsapp, city, state)
    values (l.workspace_id, l.id, l.company_name, l.phone, l.whatsapp, l.city, l.state) returning id into cid;
    created := true;
  end if;
  update public.leads set status = 'convertido', converted_at = coalesce(converted_at, now()) where id = _lead_id;
  insert into public.lead_activities (workspace_id, lead_id, activity_type, description, metadata)
  values (l.workspace_id, l.id, 'converted', 'Lead convertido em cliente',
          jsonb_build_object('client_id', cid, 'client_created', created, 'from', l.status));
  return cid;
end $$;
revoke execute on function public.convert_lead_to_client(uuid) from public, anon;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;

-- ===== Duplicate detection helpers (no automatic changes) =====
create or replace function public.norm_phone(t text) returns text language sql immutable set search_path = public as $$
  select nullif(case when length(d) >= 12 and d like '55%' then substr(d, 3) else d end, '')
  from (select regexp_replace(coalesce(t,''), '\D', '', 'g') d) x
$$;
create or replace function public.norm_url(t text) returns text language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(regexp_replace(regexp_replace(trim(coalesce(t,'')), '^https?://', '', 'i'), '^www\.', '', 'i'), '[/?#]+$', '')), '')
$$;
create or replace function public.norm_text(t text) returns text language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(trim(coalesce(t,'')), '\s+', ' ', 'g')), '')
$$;

create or replace function public.find_lead_duplicates(
  _phone text default null, _whatsapp text default null, _instagram text default null,
  _maps text default null, _website text default null, _company text default null, _city text default null,
  _exclude uuid default null
) returns table (lead_id uuid, company_name text, city text, reasons text[])
language sql stable security invoker set search_path = public as $$
  select l.id, l.company_name, l.city, array_remove(array[
    case when public.norm_phone(coalesce(_whatsapp,_phone)) is not null and public.norm_phone(coalesce(_whatsapp,_phone)) in (public.norm_phone(l.whatsapp), public.norm_phone(l.phone)) then 'telefone' end,
    case when public.norm_phone(_phone) is not null and public.norm_phone(_phone) in (public.norm_phone(l.whatsapp), public.norm_phone(l.phone)) then 'telefone' end,
    case when public.norm_url(_instagram) is not null and public.norm_url(_instagram) = public.norm_url(l.instagram_url) then 'instagram' end,
    case when public.norm_url(_maps) is not null and public.norm_url(_maps) = public.norm_url(l.google_maps_url) then 'google_maps' end,
    case when public.norm_url(_website) is not null and public.norm_url(_website) = public.norm_url(l.website_url) then 'website' end,
    case when public.norm_text(_company) is not null and public.norm_text(_company) = public.norm_text(l.company_name) and public.norm_text(_city) is not distinct from public.norm_text(l.city) then 'empresa_cidade' end
  ], null)
  from public.leads l
  where l.workspace_id = public.current_workspace_id()
    and (_exclude is null or l.id <> _exclude)
    and (
      public.norm_phone(l.whatsapp) in (public.norm_phone(_whatsapp), public.norm_phone(_phone))
      or public.norm_phone(l.phone) in (public.norm_phone(_whatsapp), public.norm_phone(_phone))
      or public.norm_url(l.instagram_url) = public.norm_url(_instagram)
      or public.norm_url(l.google_maps_url) = public.norm_url(_maps)
      or public.norm_url(l.website_url) = public.norm_url(_website)
      or (public.norm_text(l.company_name) = public.norm_text(_company) and public.norm_text(l.city) is not distinct from public.norm_text(_city))
    )
$$;
revoke execute on function public.find_lead_duplicates(text,text,text,text,text,text,text,uuid) from public, anon;
grant execute on function public.find_lead_duplicates(text,text,text,text,text,text,text,uuid) to authenticated;

-- ===== Indexes (existing: leads(workspace_id,status), leads(garimpo_id), clients(lead_id) unique, lead_activities(workspace_id,created_at)) =====
create index leads_workspace_priority_idx on public.leads (workspace_id, priority);
create index leads_assigned_to_idx on public.leads (assigned_to) where assigned_to is not null;
create index leads_workspace_followup_idx on public.leads (workspace_id, next_followup_at) where next_followup_at is not null;
create index leads_archived_idx on public.leads (workspace_id, archived_at) where archived_at is not null;
create index leads_import_batch_idx on public.leads (import_batch_id) where import_batch_id is not null;
create index leads_company_city_idx on public.leads (workspace_id, public.norm_text(company_name), public.norm_text(city));
create index leads_whatsapp_norm_idx on public.leads (workspace_id, public.norm_phone(whatsapp)) where whatsapp is not null;
create index leads_phone_norm_idx on public.leads (workspace_id, public.norm_phone(phone)) where phone is not null;
create index leads_instagram_norm_idx on public.leads (workspace_id, public.norm_url(instagram_url)) where instagram_url is not null;
create index leads_maps_norm_idx on public.leads (workspace_id, public.norm_url(google_maps_url)) where google_maps_url is not null;
create index leads_website_norm_idx on public.leads (workspace_id, public.norm_url(website_url)) where website_url is not null;
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);
create index clients_workspace_idx on public.clients (workspace_id, created_at desc);
create index site_projects_workspace_idx on public.site_projects (workspace_id, created_at desc);
create index site_projects_client_idx on public.site_projects (client_id);
create index financial_entries_workspace_idx on public.financial_entries (workspace_id, created_at desc);
