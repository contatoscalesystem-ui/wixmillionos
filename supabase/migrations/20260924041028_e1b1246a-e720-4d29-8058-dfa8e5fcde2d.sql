DROP POLICY IF EXISTS "users create own receipts" ON public.notification_receipts;
CREATE POLICY "users create own receipts" ON public.notification_receipts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.admin_notifications n WHERE n.id = notification_id
  AND (n.target_type = 'all' OR (n.target_type = 'specific_user' AND n.target_user_id = auth.uid()))
));