ALTER TABLE public.worker_attendance
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present';

UPDATE public.worker_attendance SET status = CASE WHEN present THEN 'present' ELSE 'absent' END;

ALTER TABLE public.worker_attendance
  ADD CONSTRAINT worker_attendance_status_check CHECK (status IN ('present','absent','holiday'));

ALTER TABLE public.worker_attendance
  ADD CONSTRAINT worker_attendance_worker_date_unique UNIQUE (worker_id, work_date);