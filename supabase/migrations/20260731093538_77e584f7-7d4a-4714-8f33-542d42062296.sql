CREATE TABLE public.diary_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diary_notes TO anon, authenticated;
GRANT ALL ON public.diary_notes TO service_role;
ALTER TABLE public.diary_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY diary_notes_all_public ON public.diary_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER diary_notes_updated_at BEFORE UPDATE ON public.diary_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();