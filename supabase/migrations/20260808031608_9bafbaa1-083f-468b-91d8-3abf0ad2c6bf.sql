ALTER TABLE public.worker_attendance
  ADD COLUMN IF NOT EXISTS day_type text NOT NULL DEFAULT 'full';

ALTER TABLE public.worker_attendance
  DROP CONSTRAINT IF EXISTS worker_attendance_day_type_check;

ALTER TABLE public.worker_attendance
  ADD CONSTRAINT worker_attendance_day_type_check CHECK (day_type IN ('full','half','ot'));