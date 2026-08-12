DROP POLICY IF EXISTS rentals_all_authenticated ON public.rentals;
ALTER TABLE public.rentals ALTER COLUMN created_by DROP NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentals TO anon;
CREATE POLICY rentals_all_public ON public.rentals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);