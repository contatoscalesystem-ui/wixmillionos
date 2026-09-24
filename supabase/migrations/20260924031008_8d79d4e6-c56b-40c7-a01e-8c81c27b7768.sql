-- Effective status: temp block expires on its own.
CREATE OR REPLACE FUNCTION public.effective_account_status(a public.accounts)
RETURNS public.account_status LANGUAGE sql STABLE SET search_path = public AS $$
  select case when a.status = 'temp_blocked' and a.blocked_until is not null and a.blocked_until <= now()
    then 'approved'::public.account_status else a.status end
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select p.workspace_id from public.profiles p
  where p.id = auth.uid()
    and exists (select 1 from public.user_roles r where r.user_id = p.id and r.workspace_id = p.workspace_id)
    and exists (select 1 from public.accounts a where a.user_id = p.id and public.effective_account_status(a) = 'approved')
$$;

CREATE OR REPLACE FUNCTION public.my_account()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select jsonb_build_object('status', public.effective_account_status(a), 'is_super_admin', public.is_super_admin(),
    'show_welcome', public.effective_account_status(a) = 'approved' and a.welcome_ack_at is null, 'full_name', a.full_name,
    'must_change_password', a.must_change_password,
    'blocked_until', case when public.effective_account_status(a) = 'temp_blocked' then a.blocked_until end)
  from public.accounts a where a.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select a.user_id, a.full_name, a.email, public.effective_account_status(a) as status, a.created_at, a.last_seen_at, p.workspace_id,
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
end $function$;

-- Security details (never passwords).
CREATE OR REPLACE FUNCTION public.admin_account_security(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare a public.accounts; ws uuid; r text;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select * into a from public.accounts where user_id = _user_id;
  if a.user_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  select case when exists (select 1 from public.super_admins where user_id = _user_id) then 'super_admin'
    else (select string_agg(role::text, ', ') from public.user_roles where user_id = _user_id) end into r;
  return jsonb_build_object(
    'user_id', a.user_id, 'full_name', a.full_name, 'email', a.email, 'status', public.effective_account_status(a), 'role', r,
    'created_at', a.created_at, 'last_seen_at', a.last_seen_at, 'password_changed_at', a.password_changed_at,
    'must_change_password', a.must_change_password,
    'blocked_at', a.blocked_at, 'blocked_reason', a.blocked_reason, 'blocked_until', a.blocked_until,
    'banned_at', a.banned_at, 'banned_reason', a.banned_reason, 'banned_note', a.banned_note,
    'deleted_at', a.deleted_at, 'workspace_id', ws,
    'is_super_admin', exists (select 1 from public.super_admins where user_id = _user_id),
    'counts', jsonb_build_object(
      'leads', (select count(*) from public.leads where workspace_id = ws),
      'garimpos', (select count(*) from public.garimpos where workspace_id = ws),
      'clientes', (select count(*) from public.clients where workspace_id = ws),
      'projetos', (select count(*) from public.site_projects where workspace_id = ws),
      'financeiro', (select count(*) from public.financial_entries where workspace_id = ws)));
end $$;

-- Block / temp block / unblock / ban / unban / soft delete / require password change.
CREATE OR REPLACE FUNCTION public.admin_account_action(_user_id uuid, _action text, _reason text DEFAULT NULL, _until timestamptz DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a public.accounts; ws uuid; eff public.account_status;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if _user_id = auth.uid() or exists (select 1 from public.super_admins where user_id = _user_id) then raise exception 'CANNOT_CHANGE_SUPER_ADMIN'; end if;
  select * into a from public.accounts where user_id = _user_id for update;
  if a.user_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  eff := public.effective_account_status(a);
  select workspace_id into ws from public.profiles where id = _user_id;
  if _action in ('block','temp_block','ban') and coalesce(btrim(_reason),'') = '' then raise exception 'REASON_REQUIRED'; end if;

  if _action = 'block' then
    update public.accounts set status = 'blocked', blocked_at = now(), blocked_by = auth.uid(), blocked_reason = btrim(_reason), blocked_until = null, status_changed_at = now() where user_id = _user_id;
    perform public.admin_log('USER_BLOCKED', _user_id, ws, jsonb_build_object('reason', btrim(_reason)));
  elsif _action = 'temp_block' then
    if _until is null or _until <= now() then raise exception 'INVALID_UNTIL'; end if;
    update public.accounts set status = 'temp_blocked', blocked_at = now(), blocked_by = auth.uid(), blocked_reason = btrim(_reason), blocked_until = _until, status_changed_at = now() where user_id = _user_id;
    perform public.admin_log('USER_TEMP_BLOCKED', _user_id, ws, jsonb_build_object('reason', btrim(_reason), 'until', _until));
  elsif _action = 'unblock' then
    if eff not in ('blocked','temp_blocked') then raise exception 'INVALID_STATUS'; end if;
    update public.accounts set status = 'approved', blocked_at = null, blocked_by = null, blocked_reason = null, blocked_until = null, status_changed_at = now() where user_id = _user_id;
    perform public.admin_log('USER_UNBLOCKED', _user_id, ws, '{}'::jsonb);
  elsif _action = 'ban' then
    if eff = 'deleted' then raise exception 'INVALID_STATUS'; end if;
    update public.accounts set status = 'banned', banned_at = now(), banned_by = auth.uid(), banned_reason = btrim(_reason), banned_note = nullif(btrim(coalesce(_note,'')),''),
      blocked_until = null, status_changed_at = now() where user_id = _user_id;
    perform public.admin_log('USER_BANNED', _user_id, ws, jsonb_build_object('reason', btrim(_reason)));
  elsif _action = 'unban' then
    if eff <> 'banned' then raise exception 'INVALID_STATUS'; end if;
    update public.accounts set status = 'approved', banned_at = null, banned_by = null, banned_reason = null, banned_note = null,
      blocked_at = null, blocked_by = null, blocked_reason = null, blocked_until = null, status_changed_at = now() where user_id = _user_id;
    perform public.admin_log('USER_UNBANNED', _user_id, ws, '{}'::jsonb);
  elsif _action = 'soft_delete' then
    if eff = 'deleted' then raise exception 'INVALID_STATUS'; end if;
    update public.accounts set status = 'deleted', deleted_at = now(), deleted_by = auth.uid(), status_changed_at = now() where user_id = _user_id;
    perform public.admin_log('USER_SOFT_DELETED', _user_id, ws, '{}'::jsonb);
  elsif _action = 'require_password_change' then
    update public.accounts set must_change_password = true where user_id = _user_id;
    perform public.admin_log('PASSWORD_CHANGE_REQUIRED', _user_id, ws, '{}'::jsonb);
  else raise exception 'FORBIDDEN'; end if;
end $$;

-- Password events logged by the server after a privileged change (never the password).
CREATE OR REPLACE FUNCTION public.admin_password_event(_user_id uuid, _action text, _must_change boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a public.accounts; ws uuid;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if _action not in ('PASSWORD_RESET_SENT','PASSWORD_CHANGED_BY_ADMIN','TEMP_PASSWORD_CREATED') then raise exception 'FORBIDDEN'; end if;
  select * into a from public.accounts where user_id = _user_id;
  if a.user_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if _user_id <> auth.uid() and exists (select 1 from public.super_admins where user_id = _user_id) and _action <> 'PASSWORD_RESET_SENT' then
    raise exception 'CANNOT_CHANGE_SUPER_ADMIN';
  end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  if _action <> 'PASSWORD_RESET_SENT' then
    update public.accounts set password_changed_at = now(), must_change_password = _must_change where user_id = _user_id;
  end if;
  perform public.admin_log(_action, _user_id, ws, jsonb_build_object('must_change_password', _must_change));
  return jsonb_build_object('email', a.email);
end $$;

-- User clears their own forced change after setting a new password.
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  update public.accounts set must_change_password = false, password_changed_at = now() where user_id = auth.uid()
$$;

-- Last-admin guard can be bypassed only inside a purge.
CREATE OR REPLACE FUNCTION public.protect_last_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
begin
  if current_setting('app.purging', true) = 'on' then return old; end if;
  if old.role = 'admin' and not exists (
    select 1 from public.user_roles where workspace_id = old.workspace_id and role = 'admin' and id <> old.id
  ) then raise exception 'LAST_ADMIN'; end if;
  return old;
end $function$;

-- Permanent removal of a soft-deleted account and its environment.
CREATE OR REPLACE FUNCTION public.admin_purge_account(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a public.accounts; ws uuid; others int;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if _user_id = auth.uid() or exists (select 1 from public.super_admins where user_id = _user_id) then raise exception 'CANNOT_CHANGE_SUPER_ADMIN'; end if;
  select * into a from public.accounts where user_id = _user_id for update;
  if a.user_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if a.status <> 'deleted' then raise exception 'INVALID_STATUS'; end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  perform public.admin_log('USER_PERMANENTLY_DELETED', _user_id, ws, jsonb_build_object('email', a.email));
  perform set_config('app.purging', 'on', true);
  select count(*) into others from public.profiles where workspace_id = ws and id <> _user_id;
  if ws is not null and others = 0 then
    delete from public.lead_tag_links where lead_id in (select id from public.leads where workspace_id = ws);
    delete from public.messages where workspace_id = ws;
    delete from public.conversations where workspace_id = ws;
    delete from public.whatsapp_connections where workspace_id = ws;
    delete from public.financial_entries where workspace_id = ws;
    delete from public.site_projects where workspace_id = ws;
    delete from public.clients where workspace_id = ws;
    delete from public.lead_notes where workspace_id = ws;
    delete from public.lead_activities where workspace_id = ws;
    delete from public.import_batch_rows where workspace_id = ws;
    update public.leads set import_batch_id = null where workspace_id = ws;
    delete from public.leads where workspace_id = ws;
    delete from public.import_batches where workspace_id = ws;
    delete from public.garimpos where workspace_id = ws;
    delete from public.lead_tags where workspace_id = ws;
    delete from public.message_templates where workspace_id = ws;
    delete from public.workspace_invites where workspace_id = ws;
    delete from public.platform_events where workspace_id = ws;
    delete from public.user_roles where workspace_id = ws;
    delete from public.profiles where workspace_id = ws;
    delete from public.workspaces where id = ws;
  else
    delete from public.user_roles where user_id = _user_id;
    delete from public.profiles where id = _user_id;
  end if;
  delete from public.platform_events where user_id = _user_id;
  delete from public.notification_receipts where user_id = _user_id;
  delete from public.admin_notifications where target_user_id = _user_id;
  delete from public.accounts where user_id = _user_id;
  return ws;
end $$;

REVOKE ALL ON FUNCTION public.admin_account_security(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_account_action(uuid, text, text, timestamptz, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_password_event(uuid, text, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_purge_account(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.complete_password_change() FROM public, anon;
REVOKE ALL ON FUNCTION public.effective_account_status(public.accounts) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_account_security(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_account_action(uuid, text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_password_event(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_account_status(public.accounts) TO authenticated;