-- Do not retain mobile numbers as passwords. Accounts must set a separate
-- password through Manage Users before they can sign in again.
UPDATE public.workers
SET password = NULL
WHERE password IS NOT NULL AND password = phone;

NOTIFY pgrst, 'reload schema';