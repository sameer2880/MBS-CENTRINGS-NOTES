-- The admin no longer chooses a user's password. When a user is created (or
-- has their password reset), the app sets password = their mobile number and
-- flags the row so the very next successful login is forced through a
-- "set your password" step before the session is granted.
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS must_set_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workers.must_set_password IS
  'True while the row''s password is still the mobile-number default (set at '
  'creation or on a reset). Cleared once the user chooses their own password '
  'on first login.';

-- Anyone who already has a real (non-default) password keeps it and is not
-- forced through the flow.
UPDATE public.workers
SET must_set_password = false
WHERE password IS NOT NULL;

NOTIFY pgrst, 'reload schema';