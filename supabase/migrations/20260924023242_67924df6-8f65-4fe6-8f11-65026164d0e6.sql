create type public.account_status as enum ('pending','approved','blocked','rejected');

create table public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text, company text, city text, state text,
  status public.account_status not null default 'pending',
  approved_at timestamptz, approved_by uuid,
  status_changed_at timestamptz,
  last_seen_at timestamptz,
  welcome_ack_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;

create table public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select on public.super_admins to authenticated;
grant all on public.super_admins to service_role;
alter table public.super_admins enable row level security;
create policy "own super admin row" on public.super_admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins s join public.accounts a on a.user_id = s.user_id
                 where s.user_id = auth.uid() and a.status = 'approved')
$$;

create policy "own account read" on public.accounts for select to authenticated using (user_id = auth.uid());
create policy "super admin reads accounts" on public.accounts for select to authenticated using (public.is_super_admin());
create trigger t_accounts_updated before update on public.accounts for each row execute function public.update_updated_at_column();

create table public.platform_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.platform_events to authenticated;
grant all on public.platform_events to service_role;
alter table public.platform_events enable row level security;
create policy "super admin reads events" on public.platform_events for select to authenticated using (public.is_super_admin());
create index platform_events_created_idx on public.platform_events (created_at desc);
create index platform_events_ws_idx on public.platform_events (workspace_id, created_at desc);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  target_user_id uuid,
  workspace_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_audit_logs to authenticated;
grant all on public.admin_audit_logs to service_role;
alter table public.admin_audit_logs enable row level security;
create policy "super admin reads audit" on public.admin_audit_logs for select to authenticated using (public.is_super_admin());
create index admin_audit_created_idx on public.admin_audit_logs (created_at desc);

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  target_type text not null check (target_type in ('all','specific_user')),
  target_user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'information' check (type in ('information','warning','important','maintenance')),
  show_once boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  check ((target_type = 'all' and target_user_id is null) or (target_type = 'specific_user' and target_user_id is not null))
);
grant select, insert, update, delete on public.admin_notifications to authenticated;
grant all on public.admin_notifications to service_role;
alter table public.admin_notifications enable row level security;
create policy "super admin manages notifications" on public.admin_notifications for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin() and created_by = auth.uid());
create policy "users read own notifications" on public.admin_notifications for select to authenticated
  using (exists (select 1 from public.accounts a where a.user_id = auth.uid() and a.status = 'approved')
         and (target_type = 'all' or target_user_id = auth.uid())
         and (expires_at is null or expires_at > now()));

create table public.notification_receipts (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  displayed_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  primary key (notification_id, user_id)
);
grant select, insert, update on public.notification_receipts to authenticated;
grant all on public.notification_receipts to service_role;
alter table public.notification_receipts enable row level security;
create policy "users read own receipts" on public.notification_receipts for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy "users create own receipts" on public.notification_receipts for insert to authenticated with check (user_id = auth.uid());
create policy "users update own receipts" on public.notification_receipts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Backfill: existing members approved, everyone else pending
insert into public.accounts (user_id, email, full_name, status, approved_at, welcome_ack_at, created_at)
select u.id, lower(u.email), coalesce(p.full_name, u.raw_user_meta_data->>'full_name'),
  case when exists (select 1 from public.user_roles r where r.user_id = u.id) then 'approved'::public.account_status else 'pending'::public.account_status end,
  case when exists (select 1 from public.user_roles r where r.user_id = u.id) then now() end,
  now(), u.created_at
from auth.users u left join public.profiles p on p.id = u.id
on conflict (user_id) do nothing;

insert into public.super_admins (user_id)
select id from auth.users where id = 'd2c8598b-b24e-4b2f-ae59-3f67648a8b04' on conflict do nothing;

-- Isolation: access only with an approved account
create or replace function public.current_workspace_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.workspace_id from public.profiles p
  where p.id = auth.uid()
    and exists (select 1 from public.user_roles r where r.user_id = p.id and r.workspace_id = p.workspace_id)
    and exists (select 1 from public.accounts a where a.user_id = p.id and a.status = 'approved')
$$;

create or replace function public.signup_open() returns boolean
language sql stable security definer set search_path = public as $$ select true $$;

create or replace function public.seed_workspace(_ws uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.message_templates (workspace_id, name, stage, content) values (_ws, 'SCRIPT 01 — ABORDAGEM', 'abordagem',
'Oi, tudo bem? Falo com o responsável pela [NOME_DA_EMPRESA]?

Eu encontrei vocês pesquisando algumas empresas do segmento de [NICHO] na região de [CIDADE] e separei o contato porque estou fazendo uma seleção agora nessa reta final do ano.

Como está chegando o final do ano, eu quero aumentar minhas vendas e, para isso, estou fortalecendo meu portfólio em alguns segmentos.

Um dos segmentos que quero aumentar agora é justamente o de [NICHO].

Então eu estou selecionando a dedo apenas algumas empresas desse segmento para desenvolver um site profissional completo gratuitamente, justamente para poder acrescentar esses projetos ao meu portfólio.

Ou seja, vocês não pagam nada pela construção do site.

Em troca, depois de pronto, só me autorizam a utilizar o projeto no meu portfólio como um dos sites desenvolvidos pela minha empresa.

Eu encontrei a empresa de vocês nessa pesquisa e achei que ela tem perfil para participar.

Você teria interesse?');
  insert into public.lead_tags (workspace_id, name)
  select _ws, n from unnest(array['Quente','Retornar hoje','Retornar amanhã','Sem resposta','Pensando','Preço','Cliente','Site em produção']) n;
end $$;
revoke execute on function public.seed_workspace(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ws uuid := '00000000-0000-0000-0000-000000000001'; inv public.workspace_invites;
  fname text := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1));
begin
  insert into public.accounts (user_id, email, full_name, phone, company, city, state, status)
  values (new.id, lower(new.email), fname, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'company',
          new.raw_user_meta_data->>'city', new.raw_user_meta_data->>'state', 'pending')
  on conflict (user_id) do nothing;
  if not exists (select 1 from public.user_roles where workspace_id = ws and role = 'admin') then
    insert into public.profiles (id, workspace_id, full_name, email, avatar_url) values (new.id, ws, fname, new.email, new.raw_user_meta_data->>'avatar_url');
    insert into public.user_roles (user_id, workspace_id, role) values (new.id, ws, 'admin');
    update public.accounts set status = 'approved', approved_at = now(), welcome_ack_at = now() where user_id = new.id;
    return new;
  end if;
  select * into inv from public.workspace_invites where email = lower(new.email) and status = 'pending' order by created_at desc limit 1 for update;
  if inv.id is not null then
    insert into public.profiles (id, workspace_id, full_name, email, avatar_url) values (new.id, inv.workspace_id, fname, new.email, new.raw_user_meta_data->>'avatar_url');
    insert into public.user_roles (user_id, workspace_id, role) values (new.id, inv.workspace_id, inv.role);
    update public.workspace_invites set status = 'accepted', accepted_by = new.id, accepted_at = now() where id = inv.id;
    update public.accounts set status = 'approved', approved_at = now() where user_id = new.id;
  end if;
  return new;
end $$;

create or replace function public.accept_pending_invite() returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; inv public.workspace_invites; st public.account_status;
begin
  if uid is null then return false; end if;
  select status into st from public.accounts where user_id = uid;
  if st in ('blocked','rejected') then return false; end if;
  select lower(email) into em from auth.users where id = uid;
  select * into inv from public.workspace_invites where email = em and status = 'pending' order by created_at desc limit 1 for update;
  if inv.id is null then return false; end if;
  insert into public.profiles (id, workspace_id, email) values (uid, inv.workspace_id, em)
    on conflict (id) do update set workspace_id = excluded.workspace_id;
  if not exists (select 1 from public.user_roles where user_id = uid and workspace_id = inv.workspace_id and role = inv.role) then
    insert into public.user_roles (user_id, workspace_id, role) values (uid, inv.workspace_id, inv.role);
  end if;
  update public.workspace_invites set status = 'accepted', accepted_by = uid, accepted_at = now() where id = inv.id;
  insert into public.accounts (user_id, email, status, approved_at) values (uid, em, 'approved', now())
    on conflict (user_id) do update set status = 'approved', approved_at = now();
  return true;
end $$;

-- Own account info
create or replace function public.my_account() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', a.status, 'is_super_admin', public.is_super_admin(),
    'show_welcome', a.status = 'approved' and a.welcome_ack_at is null, 'full_name', a.full_name)
  from public.accounts a where a.user_id = auth.uid()
$$;

create or replace function public.ack_welcome() returns void
language sql security definer set search_path = public as $$
  update public.accounts set welcome_ack_at = now() where user_id = auth.uid() and welcome_ack_at is null
$$;

create or replace function public.log_event(_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or _type not in ('LOGIN','LOGOUT') then return; end if;
  insert into public.platform_events (workspace_id, user_id, event_type)
  values ((select workspace_id from public.profiles where id = auth.uid()), auth.uid(), _type);
  if _type = 'LOGIN' then update public.accounts set last_seen_at = now() where user_id = auth.uid(); end if;
end $$;

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.accounts set last_seen_at = now() where user_id = auth.uid()
    and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
$$;

-- Activity events from operational tables
create or replace function public.trg_platform_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text; lbl text; meta jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'leads' then
    lbl := new.company_name;
    if tg_op = 'INSERT' then
      if new.import_batch_id is not null then return new; end if;
      t := 'LEAD_CREATED';
    elsif new.status is distinct from old.status then
      t := 'LEAD_STATUS_CHANGED'; meta := jsonb_build_object('from', old.status, 'to', new.status);
    elsif new.next_followup_at is distinct from old.next_followup_at and new.next_followup_at is not null then
      t := 'FOLLOWUP_CREATED';
    elsif (to_jsonb(new) - 'updated_at' - 'last_contact_at') is distinct from (to_jsonb(old) - 'updated_at' - 'last_contact_at') then
      t := 'LEAD_UPDATED';
    end if;
  elsif tg_table_name = 'garimpos' then
    lbl := new.name; if tg_op = 'INSERT' then t := 'GARIMPO_CREATED'; end if;
  elsif tg_table_name = 'clients' then
    lbl := new.company_name; if tg_op = 'INSERT' then t := 'CLIENT_CONVERTED'; end if;
  elsif tg_table_name = 'site_projects' then
    select company_name into lbl from public.clients where id = new.client_id;
    if tg_op = 'INSERT' then t := 'PROJECT_CREATED';
    elsif new.status is distinct from old.status or new.preview_url is distinct from old.preview_url or new.published_url is distinct from old.published_url or new.due_date is distinct from old.due_date then
      t := 'PROJECT_UPDATED'; meta := jsonb_build_object('status', new.status);
    end if;
  elsif tg_table_name = 'financial_entries' then
    lbl := new.description;
    t := case when tg_op = 'INSERT' then 'FINANCIAL_ENTRY_CREATED' else 'FINANCIAL_ENTRY_UPDATED' end;
  elsif tg_table_name = 'import_batches' then
    if new.status = 'completed' and old.status is distinct from 'completed' then
      t := 'IMPORT_COMPLETED'; lbl := new.file_name; meta := jsonb_build_object('imported_rows', new.imported_rows);
    end if;
  end if;
  if t is not null then
    insert into public.platform_events (workspace_id, user_id, event_type, entity_type, entity_id, metadata)
    values (new.workspace_id, auth.uid(), t, tg_table_name, new.id, meta || jsonb_build_object('label', left(coalesce(lbl,''), 120)));
  end if;
  return new;
end $$;
revoke execute on function public.trg_platform_event() from public, anon, authenticated;

create trigger t_ev_leads after insert or update on public.leads for each row execute function public.trg_platform_event();
create trigger t_ev_garimpos after insert on public.garimpos for each row execute function public.trg_platform_event();
create trigger t_ev_clients after insert on public.clients for each row execute function public.trg_platform_event();
create trigger t_ev_projects after insert or update on public.site_projects for each row execute function public.trg_platform_event();
create trigger t_ev_financial after insert or update on public.financial_entries for each row execute function public.trg_platform_event();
create trigger t_ev_batches after update on public.import_batches for each row execute function public.trg_platform_event();

-- Admin helpers
create or replace function public.admin_log(_action text, _target uuid, _ws uuid, _meta jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit_logs (admin_id, target_user_id, workspace_id, action, metadata) values (auth.uid(), _target, _ws, _action, _meta)
$$;
revoke execute on function public.admin_log(text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_approve_user(_user_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid; acc public.accounts;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select * into acc from public.accounts where user_id = _user_id for update;
  if acc.user_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  if ws is null then
    insert into public.workspaces (id, name) values (gen_random_uuid(), coalesce(nullif(acc.full_name,''), acc.email)) returning id into ws;
    insert into public.profiles (id, workspace_id, full_name, email) values (_user_id, ws, acc.full_name, acc.email);
    insert into public.user_roles (user_id, workspace_id, role) values (_user_id, ws, 'admin');
    perform public.seed_workspace(ws);
  elsif not exists (select 1 from public.user_roles where user_id = _user_id and workspace_id = ws) then
    insert into public.user_roles (user_id, workspace_id, role) values (_user_id, ws, 'admin');
  end if;
  update public.accounts set status = 'approved', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, auth.uid()),
    status_changed_at = now() where user_id = _user_id;
  perform public.admin_log(case when acc.status = 'blocked' then 'ADMIN_UNBLOCKED_USER' else 'ADMIN_APPROVED_USER' end, _user_id, ws, '{}'::jsonb);
  return ws;
end $$;

create or replace function public.admin_set_account_status(_user_id uuid, _status public.account_status) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if _status = 'approved' then perform public.admin_approve_user(_user_id); return; end if;
  if _user_id = auth.uid() or exists (select 1 from public.super_admins where user_id = _user_id) then raise exception 'CANNOT_CHANGE_SUPER_ADMIN'; end if;
  if _status = 'pending' then raise exception 'FORBIDDEN'; end if;
  update public.accounts set status = _status, status_changed_at = now() where user_id = _user_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  perform public.admin_log(case _status when 'blocked' then 'ADMIN_BLOCKED_USER' else 'ADMIN_REJECTED_USER' end, _user_id, ws, '{}'::jsonb);
end $$;

create or replace function public.admin_global_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.accounts),
    'users_active', (select count(*) from public.accounts where status = 'approved'),
    'users_pending', (select count(*) from public.accounts where status = 'pending'),
    'users_blocked', (select count(*) from public.accounts where status = 'blocked'),
    'leads', (select count(*) from public.leads where archived_at is null),
    'garimpos', (select count(*) from public.garimpos),
    'clients', (select count(*) from public.clients),
    'conversions', (select count(*) from public.leads where status = 'convertido'),
    'projects_in_production', (select count(*) from public.site_projects where status <> 'publicado'),
    'sites_published', (select count(*) from public.site_projects where status = 'publicado'),
    'revenue', (select coalesce(sum(platform_amount),0) from public.financial_entries where status <> 'cancelado'),
    'commission', (select coalesce(sum(commission_amount),0) from public.financial_entries where status <> 'cancelado'));
end $$;

create or replace function public.admin_list_users() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select a.user_id, a.full_name, a.email, a.status, a.created_at, a.last_seen_at, p.workspace_id,
      exists (select 1 from public.super_admins s where s.user_id = a.user_id) as is_super_admin,
      coalesce(l.total,0) leads, coalesce(l.novos,0) novos, coalesce(l.abordagens,0) abordagens, coalesce(l.respostas,0) respostas,
      coalesce(l.interessados,0) interessados, coalesce(l.links,0) links, coalesce(l.convertidos,0) convertidos,
      (select count(*) from public.garimpos g where g.workspace_id = p.workspace_id) garimpos,
      (select count(*) from public.clients c where c.workspace_id = p.workspace_id) clientes,
      (select count(*) from public.site_projects sp where sp.workspace_id = p.workspace_id) projetos,
      (select count(*) from public.site_projects sp where sp.workspace_id = p.workspace_id and sp.status = 'publicado') publicados,
      (select coalesce(sum(platform_amount),0) from public.financial_entries f where f.workspace_id = p.workspace_id and f.status <> 'cancelado') faturamento,
      (select coalesce(sum(commission_amount),0) from public.financial_entries f where f.workspace_id = p.workspace_id and f.status <> 'cancelado') comissao,
      (select max(created_at) from public.platform_events e where e.user_id = a.user_id) ultima_atividade
    from public.accounts a
    left join public.profiles p on p.id = a.user_id
    left join lateral (
      select count(*) total,
        count(*) filter (where status = 'novo') novos,
        count(*) filter (where status not in ('novo','validar','pronto_contato','nao_qualificado')) abordagens,
        count(*) filter (where status in ('respondeu','interessado','valor_apresentado','oferta_apresentada','link_enviado','convertido')) respostas,
        count(*) filter (where status in ('interessado','valor_apresentado','oferta_apresentada','link_enviado','convertido')) interessados,
        count(*) filter (where status in ('link_enviado','convertido')) links,
        count(*) filter (where status = 'convertido') convertidos
      from public.leads where workspace_id = p.workspace_id and archived_at is null) l on true
  ) x), '[]'::jsonb);
end $$;

create or replace function public.admin_user_data(_user_id uuid, _section text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ws uuid; res jsonb;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  if _section = 'overview' then
    res := jsonb_build_object(
      'account', (select to_jsonb(a) from public.accounts a where a.user_id = _user_id),
      'workspace_id', ws,
      'events', coalesce((select jsonb_agg(e) from (select event_type, entity_type, metadata, created_at from public.platform_events where workspace_id = ws order by created_at desc limit 20) e), '[]'),
      'recent_leads', coalesce((select jsonb_agg(l) from (select id, company_name, city, status, created_at from public.leads where workspace_id = ws order by created_at desc limit 10) l), '[]'),
      'recent_clients', coalesce((select jsonb_agg(c) from (select id, company_name, city, created_at from public.clients where workspace_id = ws order by created_at desc limit 10) c), '[]'),
      'recent_financial', coalesce((select jsonb_agg(f) from (select id, type, description, platform_amount, platform_currency, commission_amount, commission_currency, status, created_at from public.financial_entries where workspace_id = ws order by created_at desc limit 10) f), '[]'));
  elsif ws is null then res := '[]'::jsonb;
  elsif _section = 'garimpos' then
    select coalesce(jsonb_agg(g order by g.created_at desc), '[]') into res from (select id, name, niche, city, state, source, total_leads, status, created_at from public.garimpos where workspace_id = ws) g;
  elsif _section in ('leads','pipeline','recuperacao','agenda') then
    select coalesce(jsonb_agg(l order by l.created_at desc), '[]') into res from (
      select id, company_name, niche, city, state, phone, whatsapp, status, priority, score, next_followup_at, last_contact_at, archived_at, created_at
      from public.leads where workspace_id = ws
        and (_section <> 'recuperacao' or status in ('recuperacao','sem_resposta'))
        and (_section <> 'agenda' or next_followup_at is not null)
        and (_section = 'leads' or archived_at is null)) l;
  elsif _section = 'clientes' then
    select coalesce(jsonb_agg(c order by c.created_at desc), '[]') into res from (select id, company_name, contact_name, whatsapp, city, state, status, created_at from public.clients where workspace_id = ws) c;
  elsif _section = 'producao' then
    select coalesce(jsonb_agg(s order by s.created_at desc), '[]') into res from (select sp.id, c.company_name, sp.status, sp.preview_url, sp.published_url, sp.due_date, sp.created_at from public.site_projects sp left join public.clients c on c.id = sp.client_id where sp.workspace_id = ws) s;
  elsif _section = 'financeiro' then
    select coalesce(jsonb_agg(f order by f.created_at desc), '[]') into res from (select id, type, description, platform_amount, platform_currency, commission_amount, commission_currency, status, expected_date, paid_date, created_at from public.financial_entries where workspace_id = ws) f;
  elsif _section = 'atividades' then
    select coalesce(jsonb_agg(a order by a.created_at desc), '[]') into res from (select la.activity_type, la.description, la.created_at, l.company_name from public.lead_activities la left join public.leads l on l.id = la.lead_id where la.workspace_id = ws order by la.created_at desc limit 300) a;
  elsif _section = 'auditoria' then
    select coalesce(jsonb_agg(b order by b.created_at desc), '[]') into res from (select id, file_name, status, total_rows, valid_rows, invalid_rows, duplicate_rows, imported_rows, audit->>'status' audit_status, created_at, completed_at from public.import_batches where workspace_id = ws) b;
  else raise exception 'FORBIDDEN';
  end if;
  perform public.admin_log(case _section when 'overview' then 'ADMIN_VIEWED_USER' when 'financeiro' then 'ADMIN_VIEWED_FINANCIAL' else 'ADMIN_VIEWED_' || upper(_section) end, _user_id, ws, jsonb_build_object('section', _section));
  return res;
end $$;

create or replace function public.admin_activity(_limit int default 300) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select e.id, e.event_type, e.entity_type, e.metadata, e.created_at, e.user_id, e.workspace_id,
      a.full_name, a.email, w.name workspace_name
    from public.platform_events e left join public.accounts a on a.user_id = e.user_id left join public.workspaces w on w.id = e.workspace_id
    order by e.created_at desc limit least(greatest(_limit, 1), 2000)) x), '[]'::jsonb);
end $$;

do $$ declare f text; begin
  foreach f in array array['is_super_admin()','my_account()','ack_welcome()','log_event(text)','touch_last_seen()','admin_approve_user(uuid)',
    'admin_set_account_status(uuid, public.account_status)','admin_global_stats()','admin_list_users()','admin_user_data(uuid, text)','admin_activity(integer)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;