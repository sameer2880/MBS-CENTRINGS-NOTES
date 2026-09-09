CREATE TABLE public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  daily_wage numeric not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO anon, authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY workers_all_public ON public.workers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER workers_updated_at BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.worker_attendance (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  work_date date not null,
  present boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_attendance TO anon, authenticated;
GRANT ALL ON public.worker_attendance TO service_role;
ALTER TABLE public.worker_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY worker_attendance_all_public ON public.worker_attendance FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER worker_attendance_updated_at BEFORE UPDATE ON public.worker_attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  amount numeric not null default 0,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_payments TO anon, authenticated;
GRANT ALL ON public.worker_payments TO service_role;
ALTER TABLE public.worker_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY worker_payments_all_public ON public.worker_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER worker_payments_updated_at BEFORE UPDATE ON public.worker_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();