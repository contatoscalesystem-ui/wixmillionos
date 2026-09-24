CREATE OR REPLACE FUNCTION public.admin_approve_user(_user_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare ws uuid; acc public.accounts;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select * into acc from public.accounts where user_id = _user_id for update;
  if acc.user_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  select workspace_id into ws from public.profiles where id = _user_id;
  if ws is null then
    insert into public.workspaces (id, name) values (gen_random_uuid(), coalesce(nullif(acc.full_name,''), acc.email)) returning id into ws;
    insert into public.profiles (id, workspace_id, full_name, email) values (_user_id, ws, acc.full_name, acc.email);
    insert into public.user_roles (user_id, workspace_id, role) values (_user_id, ws, 'operador');
    perform public.seed_workspace(ws);
  elsif not exists (select 1 from public.user_roles where user_id = _user_id and workspace_id = ws) then
    insert into public.user_roles (user_id, workspace_id, role) values (_user_id, ws, 'operador');
  end if;
  update public.accounts set status = 'approved', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, auth.uid()),
    status_changed_at = now() where user_id = _user_id;
  perform public.admin_log(case when acc.status = 'blocked' then 'ADMIN_UNBLOCKED_USER' else 'ADMIN_APPROVED_USER' end, _user_id, ws, '{}'::jsonb);
  return ws;
end $function$;

REVOKE ALL ON FUNCTION public.admin_approve_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_approve_user(uuid) TO authenticated;

-- Super admin row can never be written through the API.
REVOKE INSERT, UPDATE, DELETE ON public.super_admins FROM anon, authenticated;