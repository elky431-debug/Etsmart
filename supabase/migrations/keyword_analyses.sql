-- Analyses keywords Etsy (jobs async + cache 24h côté app)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.keyword_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'error')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS keyword_analyses_user_id_idx ON public.keyword_analyses(user_id);
CREATE INDEX IF NOT EXISTS keyword_analyses_keyword_idx ON public.keyword_analyses(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_analyses_user_created
  ON public.keyword_analyses(user_id, created_at DESC);

ALTER TABLE public.keyword_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "keyword_analyses_select_own" ON public.keyword_analyses;
DROP POLICY IF EXISTS "keyword_analyses_insert_own" ON public.keyword_analyses;
DROP POLICY IF EXISTS "keyword_analyses_update_own" ON public.keyword_analyses;
DROP POLICY IF EXISTS "Users see own analyses" ON public.keyword_analyses;

CREATE POLICY "Users see own analyses" ON public.keyword_analyses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
