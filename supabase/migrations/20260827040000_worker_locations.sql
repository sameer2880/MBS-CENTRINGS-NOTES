-- Live location tracking for workers.
-- One row per worker holding their latest known GPS fix + whether they
-- currently have location sharing switched on. Historical pings are not
-- kept — this is a live "where are they right now" view, not a trail log.

CREATE TABLE public.worker_locations (
  worker_id uuid PRIMARY KEY REFERENCES public.workers(id) ON DELETE CASCADE,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  sharing_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_locations TO anon, authenticated;
GRANT ALL ON public.worker_locations TO service_role;
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;

-- Matches the "legacy" anon-key admin access used by the rest of this app.
CREATE POLICY worker_locations_legacy_admin ON public.worker_locations
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Real Supabase-auth sessions (workers/admins/managers logged in properly).
CREATE POLICY worker_locations_worker_read_own ON public.worker_locations
  FOR SELECT TO authenticated
  USING (
    worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY worker_locations_worker_write_own ON public.worker_locations
  FOR INSERT TO authenticated
  WITH CHECK (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'));

CREATE POLICY worker_locations_worker_update_own ON public.worker_locations
  FOR UPDATE TO authenticated
  USING (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'))
  WITH CHECK (worker_id::text = (auth.jwt() -> 'user_metadata' ->> 'worker_id'));

CREATE POLICY worker_locations_staff_manage ON public.worker_locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER worker_locations_updated_at
  BEFORE UPDATE ON public.worker_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';