-- 012_wrong_id_reports.sql
-- Adds wrong_id_reports table to capture user-reported misidentifications.
-- Backlog #18 (card-reveal "Wrong ID" flow) + #19 (low-confidence decline path).
--
-- Two entry points feed this table:
--   1. Low-confidence decline (`source='low-confidence-decline'`): user is
--      shown "Hmm, this one's tricky — try another angle?" and chooses to
--      retake. The decline silently logs the returned class for analysis.
--   2. Card-reveal "Wrong ID" tap (`source='card-wrong-id'`): user accepts
--      the result, sees the card, then realises it's wrong. First tap logs
--      silently with returned_class only; optional secondary tap opens an
--      input for the correct class which is logged as user_correction.
--
-- Both anonymous and authenticated users can submit reports. Reads are
-- locked down — admin/service-role only via dashboard. Triage workflow lives
-- outside the app.

CREATE TABLE IF NOT EXISTS public.wrong_id_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  spot_id UUID REFERENCES public.spots(id) ON DELETE CASCADE,
  photo_url TEXT,
  returned_class TEXT NOT NULL,
  returned_operator TEXT,
  returned_confidence INTEGER,
  user_correction TEXT,
  source TEXT NOT NULL CHECK (source IN ('low-confidence-decline', 'card-wrong-id')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wrong_id_reports_returned_class
  ON public.wrong_id_reports (returned_class);

CREATE INDEX IF NOT EXISTS idx_wrong_id_reports_created_at
  ON public.wrong_id_reports (created_at DESC);

ALTER TABLE public.wrong_id_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous or authenticated) can submit a report.
-- If user_id is set, it must match auth.uid(); anonymous reports leave it NULL.
CREATE POLICY "Anyone can submit a wrong-ID report"
  ON public.wrong_id_reports FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- No SELECT policy — table is write-only from the client.
-- Service-role (Supabase dashboard) bypasses RLS for triage queries.
