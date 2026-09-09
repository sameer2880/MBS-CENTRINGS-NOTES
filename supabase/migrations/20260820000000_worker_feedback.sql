CREATE TABLE public.worker_feedback (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  work_date date not null,
  attendance_feedback text,
  payment_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, work_date)
);

GRANT SELECT, INSERT, UPDATE ON public.worker_feedback TO anon, authenticated;
GRANT ALL ON public.worker_feedback TO service_role;
ALTER TABLE public.worker_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_feedback_legacy_admin ON public.worker_feedback
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY worker_feedback_worker_read_own ON public.worker_feedback
  FOR SELECT TO authenticated
  USING (
    worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY worker_feedback_worker_write_own ON public.worker_feedback
  FOR INSERT TO authenticated
  WITH CHECK (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'));

CREATE POLICY worker_feedback_worker_update_own ON public.worker_feedback
  FOR UPDATE TO authenticated
  USING (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'))
  WITH CHECK (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'));

CREATE POLICY worker_feedback_staff_manage ON public.worker_feedback
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER worker_feedback_updated_at
  BEFORE UPDATE ON public.worker_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
