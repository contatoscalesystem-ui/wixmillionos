DROP POLICY IF EXISTS "users read own notifications" ON public.admin_notifications;
CREATE POLICY "users read own notifications" ON public.admin_notifications FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.user_id = auth.uid() AND a.status = 'approved')
  AND (target_type = 'all' OR (target_type = 'specific_user' AND target_user_id = auth.uid()))
  AND (expires_at IS NULL OR expires_at > now())
);
ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_target_chk;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_target_chk CHECK (
  (target_type = 'all' AND target_user_id IS NULL) OR (target_type = 'specific_user' AND target_user_id IS NOT NULL)
);