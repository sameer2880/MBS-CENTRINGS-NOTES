CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  entity_id uuid,
  notify_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_legacy_read ON public.notifications
  FOR SELECT TO anon USING (true);
CREATE POLICY notifications_staff_read ON public.notifications
  FOR SELECT TO authenticated
  USING (
    notify_admin AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    OR worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id')
  );

CREATE INDEX notifications_worker_created_at_idx
  ON public.notifications (worker_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_activity_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  worker_name text;
  activity text;
  notification_title text;
  notification_body text;
  target_worker uuid;
BEGIN
  IF TG_TABLE_NAME = 'rentals' THEN
    activity := lower(TG_OP) || '_rental';
    notification_title := CASE WHEN TG_OP = 'INSERT' THEN 'New rental added' ELSE 'Rental updated' END;
    notification_body := NEW.customer_name || ' · ' || NEW.material_name || ' · ₹' || NEW.total_amount;
    target_worker := NULL;
  ELSIF TG_TABLE_NAME = 'worker_attendance' THEN
    target_worker := NEW.worker_id;
    SELECT name INTO worker_name FROM public.workers WHERE id = target_worker;
    activity := lower(TG_OP) || '_attendance';
    notification_title := 'Attendance updated';
    notification_body := COALESCE(worker_name, 'Worker') || ' · ' || NEW.work_date || ' · ' || NEW.status;
  ELSIF TG_TABLE_NAME = 'worker_payments' THEN
    target_worker := NEW.worker_id;
    SELECT name INTO worker_name FROM public.workers WHERE id = target_worker;
    activity := lower(TG_OP) || '_payment';
    notification_title := 'Payment updated';
    notification_body := COALESCE(worker_name, 'Worker') || ' · ₹' || NEW.amount;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (event_type, title, body, worker_id, entity_id)
  VALUES (activity, notification_title, notification_body, target_worker, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER rentals_activity_notification
  AFTER INSERT OR UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
CREATE TRIGGER attendance_activity_notification
  AFTER INSERT OR UPDATE ON public.worker_attendance
  FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();
CREATE TRIGGER payments_activity_notification
  AFTER INSERT OR UPDATE ON public.worker_payments
  FOR EACH ROW EXECUTE FUNCTION public.create_activity_notification();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';