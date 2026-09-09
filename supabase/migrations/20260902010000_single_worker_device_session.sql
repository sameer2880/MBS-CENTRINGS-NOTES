ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS session_token text;

COMMENT ON COLUMN public.workers.session_token IS
  'Token for the one device currently signed in to this worker account.';

NOTIFY pgrst, 'reload schema';