-- Jobs génération images (Netlify Background Function + polling)
CREATE TABLE IF NOT EXISTS image_gen_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  request_body JSONB NOT NULL,
  result_json JSONB,
  http_status INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_user ON image_gen_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_status_created ON image_gen_jobs(status, created_at DESC);

ALTER TABLE image_gen_jobs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE image_gen_jobs IS 'File async génération images ; accès uniquement service role / API.';
