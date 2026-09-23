
create type public.app_role as enum ('admin','operador');
create type public.garimpo_status as enum ('rascunho','processado','ativo','arquivado');
create type public.lead_priority as enum ('A','B','C','D');
create type public.lead_status as enum ('novo','validar','pronto_contato','abordagem_enviada','sem_resposta','respondeu','interessado','valor_apresentado','oferta_apresentada','link_enviado','convertido','recuperacao','perdido','nao_qualificado');
create type public.website_status as enum ('nao_possui','site_fraco','site_razoavel','site_profissional','nao_confirmado');
create type public.project_status as enum ('aguardando','coleta_dados','producao','primeira_versao','revisao','aprovado','transferencia','publicado');
create type public.financial_status as enum ('pendente','confirmado','a_receber','recebido','cancelado');

create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;

create table public.profiles (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.current_workspace_id() returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.profiles where id = auth.uid()
$$;
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "members read workspace" on public.workspaces for select to authenticated using (id = public.current_workspace_id());
create policy "admins update workspace" on public.workspaces for update to authenticated using (id = public.current_workspace_id() and public.has_role(auth.uid(),'admin'));
create policy "members read profiles" on public.profiles for select to authenticated using (workspace_id = public.current_workspace_id());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and workspace_id = public.current_workspace_id());
create policy "members read roles" on public.user_roles for select to authenticated using (workspace_id = public.current_workspace_id());
create policy "admins manage roles" on public.user_roles for all to authenticated using (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(),'admin')) with check (workspace_id = public.current_workspace_id() and public.has_role(auth.uid(),'admin'));

create trigger t_ws_upd before update on public.workspaces for each row execute function public.update_updated_at_column();
create trigger t_pr_upd before update on public.profiles for each row execute function public.update_updated_at_column();

-- Business tables
create table public.garimpos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null, niche text, city text, state text, research_date date, source text,
  original_file_name text, original_file_url text, total_leads integer not null default 0,
  status public.garimpo_status not null default 'rascunho',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  garimpo_id uuid references public.garimpos(id) on delete set null,
  position integer, score numeric, priority public.lead_priority,
  company_name text not null, niche text, city text, state text, neighborhood text, address text,
  phone text, whatsapp text, whatsapp_confirmed boolean not null default false,
  instagram_url text, instagram_followers integer, google_maps_url text, google_rating numeric, google_reviews integer,
  website_url text, website_status public.website_status not null default 'nao_confirmado',
  scheduling_type text, scheduling_url text, digital_presence text, photo_quality text,
  commercial_observation text, raw_source_data jsonb,
  status public.lead_status not null default 'novo',
  assigned_to uuid, last_contact_at timestamptz, next_followup_at timestamptz, converted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.leads(workspace_id, status);
create index on public.leads(garimpo_id);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  user_id uuid default auth.uid(),
  activity_type text not null, description text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.lead_activities(workspace_id, created_at desc);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid default auth.uid(), content text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null, stage text, content text not null, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  lead_id uuid unique references public.leads(id) on delete set null,
  company_name text not null, contact_name text, phone text, whatsapp text, email text, city text, state text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.site_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  responsible_user_id uuid, status public.project_status not null default 'aguardando',
  preview_url text, published_url text, due_date date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  type text not null default 'venda', description text,
  platform_amount numeric, platform_currency text not null default 'BRL',
  commission_amount numeric, commission_currency text not null default 'BRL',
  status public.financial_status not null default 'pendente',
  expected_date date, paid_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  provider text, phone_number text, phone_number_id text, waba_id text,
  connection_status text not null default 'disconnected', coexistence_enabled boolean not null default false,
  connected_at timestamptz, disconnected_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  channel text not null default 'whatsapp', external_contact_id text, assigned_to uuid,
  status text not null default 'open', last_message_at timestamptz, unread_count integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  sender_type text, sender_user_id uuid, external_message_id text,
  direction text, message_type text default 'text', content text, status text,
  sent_at timestamptz, delivered_at timestamptz, read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.lead_tag_links (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.lead_tags(id) on delete cascade,
  primary key (lead_id, tag_id)
);

do $$
declare t text;
begin
  foreach t in array array['garimpos','leads','lead_activities','lead_notes','message_templates','clients','site_projects','financial_entries','whatsapp_connections','conversations','messages','lead_tags'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "workspace members access" on public.%I for all to authenticated using (workspace_id = public.current_workspace_id()) with check (workspace_id = public.current_workspace_id())', t);
  end loop;
  foreach t in array array['garimpos','leads','lead_notes','message_templates','clients','site_projects','financial_entries','whatsapp_connections','conversations'] loop
    execute format('create trigger t_upd before update on public.%I for each row execute function public.update_updated_at_column()', t);
  end loop;
end $$;

grant select, insert, delete on public.lead_tag_links to authenticated;
grant all on public.lead_tag_links to service_role;
alter table public.lead_tag_links enable row level security;
create policy "workspace members access tag links" on public.lead_tag_links for all to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and l.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.leads l where l.id = lead_id and l.workspace_id = public.current_workspace_id())
    and exists (select 1 from public.lead_tags g where g.id = tag_id and g.workspace_id = public.current_workspace_id()));

-- Keep garimpo lead counts in sync
create or replace function public.sync_garimpo_total() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.garimpo_id is not null then
    update public.garimpos set total_leads = (select count(*) from public.leads where garimpo_id = old.garimpo_id) where id = old.garimpo_id;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.garimpo_id is not null then
    update public.garimpos set total_leads = (select count(*) from public.leads where garimpo_id = new.garimpo_id) where id = new.garimpo_id;
  end if;
  return null;
end; $$;
create trigger t_leads_garimpo_total after insert or update of garimpo_id or delete on public.leads for each row execute function public.sync_garimpo_total();

-- Default workspace + seeds
insert into public.workspaces (id, name) values ('00000000-0000-0000-0000-000000000001','WIX MILLION');

insert into public.message_templates (workspace_id, name, stage, content) values ('00000000-0000-0000-0000-000000000001','SCRIPT 01 — ABORDAGEM','abordagem',
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
select '00000000-0000-0000-0000-000000000001', n from unnest(array['Quente','Retornar hoje','Retornar amanhã','Sem resposta','Pensando','Preço','Cliente','Site em produção']) n;

-- New user -> profile in WIX MILLION; first user is admin
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare ws uuid := '00000000-0000-0000-0000-000000000001'; is_first boolean;
begin
  select not exists (select 1 from public.user_roles where workspace_id = ws) into is_first;
  insert into public.profiles (id, workspace_id, full_name, email, avatar_url)
  values (new.id, ws, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, workspace_id, role) values (new.id, ws, case when is_first then 'admin'::public.app_role else 'operador'::public.app_role end);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
