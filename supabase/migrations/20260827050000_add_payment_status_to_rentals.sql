ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_payment_status_check;

ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_payment_status_check CHECK (payment_status IN ('paid', 'unpaid'));