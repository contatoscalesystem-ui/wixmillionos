
ALTER TABLE public.clients DROP CONSTRAINT clients_lead_id_fkey,
  ADD CONSTRAINT clients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT;
ALTER TABLE public.site_projects DROP CONSTRAINT site_projects_client_id_fkey,
  ADD CONSTRAINT site_projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_entries DROP CONSTRAINT financial_entries_client_id_fkey,
  ADD CONSTRAINT financial_entries_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_entries DROP CONSTRAINT financial_entries_lead_id_fkey,
  ADD CONSTRAINT financial_entries_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clients','site_projects'] LOOP
    EXECUTE format('DROP POLICY "workspace members access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id())', t);
    EXECUTE format('CREATE POLICY "members insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id())', t);
    EXECUTE format('CREATE POLICY "members update" ON public.%I FOR UPDATE TO authenticated USING (workspace_id = public.current_workspace_id()) WITH CHECK (workspace_id = public.current_workspace_id())', t);
    EXECUTE format('CREATE POLICY "admins delete" ON public.%I FOR DELETE TO authenticated USING (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;
