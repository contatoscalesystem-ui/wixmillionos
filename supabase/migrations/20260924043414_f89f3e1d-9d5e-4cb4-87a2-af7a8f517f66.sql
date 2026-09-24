create or replace function public.delete_leads_bulk(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ws uuid := public.current_workspace_id();
  lid uuid; deleted int := 0; failed jsonb := '[]'::jsonb; nm text;
begin
  if auth.uid() is null or ws is null then raise exception 'Sem acesso' using errcode = '42501'; end if;
  if coalesce(array_length(p_ids,1),0) > 5000 then raise exception 'Limite de 5000 leads por operação'; end if;
  foreach lid in array coalesce(p_ids, '{}') loop
    select company_name into nm from public.leads where id = lid and workspace_id = ws;
    if not found then
      failed := failed || jsonb_build_object('id', lid, 'name', null, 'reason', 'Lead não encontrado neste workspace');
      continue;
    end if;
    if exists (select 1 from public.clients where lead_id = lid) or exists (select 1 from public.financial_entries where lead_id = lid) then
      failed := failed || jsonb_build_object('id', lid, 'name', nm, 'reason', 'Possui cliente ou financeiro vinculado');
      continue;
    end if;
    begin
      delete from public.leads where id = lid and workspace_id = ws;
      deleted := deleted + 1;
    exception when others then
      failed := failed || jsonb_build_object('id', lid, 'name', nm, 'reason', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('deleted_count', deleted, 'failed_count', jsonb_array_length(failed), 'failed', failed);
end $$;
revoke all on function public.delete_leads_bulk(uuid[]) from public, anon;
grant execute on function public.delete_leads_bulk(uuid[]) to authenticated;