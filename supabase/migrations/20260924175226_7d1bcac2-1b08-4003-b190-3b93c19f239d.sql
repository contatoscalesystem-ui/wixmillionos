CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pinned_pipeline_garimpo_id uuid REFERENCES public.garimpos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.user_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own prefs insert" ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND workspace_id = public.current_workspace_id()
    AND (pinned_pipeline_garimpo_id IS NULL OR EXISTS (SELECT 1 FROM public.garimpos g WHERE g.id = pinned_pipeline_garimpo_id AND g.workspace_id = public.current_workspace_id())));
CREATE POLICY "own prefs update" ON public.user_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND workspace_id = public.current_workspace_id()
    AND (pinned_pipeline_garimpo_id IS NULL OR EXISTS (SELECT 1 FROM public.garimpos g WHERE g.id = pinned_pipeline_garimpo_id AND g.workspace_id = public.current_workspace_id())));
CREATE POLICY "own prefs delete" ON public.user_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();