-- ============================================================
-- LocoSnap — Fix handle_new_user function search path
-- Adds SET search_path = '' to prevent search path injection.
-- Function already uses fully-qualified names (public.profiles)
-- so this is a safe, non-breaking change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
