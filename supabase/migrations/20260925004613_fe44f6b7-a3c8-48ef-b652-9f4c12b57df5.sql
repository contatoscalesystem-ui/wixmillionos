CREATE TABLE public.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  affiliate_link_name text NOT NULL DEFAULT 'Link de afiliado',
  affiliate_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.workspace_settings TO authenticated;
GRANT ALL ON public.workspace_settings TO service_role;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members read settings" ON public.workspace_settings FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "ws members insert settings" ON public.workspace_settings FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id());
CREATE POLICY "ws members update settings" ON public.workspace_settings FOR UPDATE TO authenticated USING (workspace_id = public.current_workspace_id()) WITH CHECK (workspace_id = public.current_workspace_id());
CREATE TRIGGER trg_workspace_settings_updated BEFORE UPDATE ON public.workspace_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.workspace_settings (workspace_id, affiliate_link) VALUES ('00000000-0000-0000-0000-000000000001', 'https://storebuild.ai/rian-medeiros-sub/?via=erc') ON CONFLICT DO NOTHING;
UPDATE public.script_stages SET main_message = replace(main_message, '[LINK]', '[LINK_AFILIADO]'), variations = replace(variations, '[LINK]', '[LINK_AFILIADO]') WHERE main_message LIKE '%[LINK]%' OR variations LIKE '%[LINK]%';