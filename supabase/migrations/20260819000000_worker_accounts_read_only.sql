DROP POLICY IF EXISTS workers_all_public ON public.workers;
DROP POLICY IF EXISTS worker_attendance_all_public ON public.worker_attendance;
DROP POLICY IF EXISTS worker_payments_all_public ON public.worker_payments;

CREATE POLICY workers_legacy_admin ON public.workers
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY worker_attendance_legacy_admin ON public.worker_attendance
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY worker_payments_legacy_admin ON public.worker_payments
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY workers_worker_read_own ON public.workers
  FOR SELECT TO authenticated
  USING (
    id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY workers_staff_manage ON public.workers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY worker_attendance_worker_read_own ON public.worker_attendance
  FOR SELECT TO authenticated
  USING (
    worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY worker_attendance_staff_manage ON public.worker_attendance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY worker_payments_worker_read_own ON public.worker_payments
  FOR SELECT TO authenticated
  USING (
    worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY worker_payments_staff_manage ON public.worker_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

NOTIFY pgrst, 'reload schema';