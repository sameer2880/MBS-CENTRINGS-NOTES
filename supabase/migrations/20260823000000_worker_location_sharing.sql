-- Opt-in, visible location sharing for workers.
-- Workers explicitly turn sharing on/off from their own device; the current
-- state is always shown to them in the app (see WorkerLocationToggle).
-- Admin/manager can view live positions only while a worker has sharing ON.

CREATE TABLE public.worker_locations (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m numeric,
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_locations TO authenticated;
GRANT ALL ON public.worker_locations TO service_role;
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;

-- A worker can only write/read their own row.
CREATE POLICY worker_locations_worker_own ON public.worker_locations
  FOR ALL TO authenticated
  USING (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'))
  WITH CHECK (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'));

-- Admin/manager can only see rows where the worker has sharing switched on.
-- (No write access for staff — they can't fake or clear a worker's location.)
CREATE POLICY worker_locations_staff_view_when_shared ON public.worker_locations
  FOR SELECT TO authenticated
  USING (
    sharing_enabled = true
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER worker_locations_updated_at
  BEFORE UPDATE ON public.worker_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();