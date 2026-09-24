drop policy if exists "admins delete leads" on public.leads;
create policy "members delete own workspace leads" on public.leads for delete to authenticated using (workspace_id = public.current_workspace_id());
drop policy if exists "admins write templates" on public.message_templates;
create policy "members insert templates" on public.message_templates for insert to authenticated with check (workspace_id = public.current_workspace_id());
create policy "members update templates" on public.message_templates for update to authenticated using (workspace_id = public.current_workspace_id()) with check (workspace_id = public.current_workspace_id());
create policy "members delete templates" on public.message_templates for delete to authenticated using (workspace_id = public.current_workspace_id());