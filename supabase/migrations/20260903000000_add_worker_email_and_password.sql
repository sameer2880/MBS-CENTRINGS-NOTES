ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password text;

-- Preserve existing logins while moving credentials out of the mobile field.
UPDATE public.workers
SET password = phone
WHERE password IS NULL AND phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workers_email_lower_unique
  ON public.workers (lower(email))
  WHERE email IS NOT NULL;

NOTIFY pgrst, 'reload schema';
