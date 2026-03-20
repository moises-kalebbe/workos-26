BEGIN;

ALTER TABLE public.vault_repositories
  ADD COLUMN IF NOT EXISTS supabase_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supabase_project_ref text,
  ADD COLUMN IF NOT EXISTS supabase_project_url text,
  ADD COLUMN IF NOT EXISTS supabase_api_url text,
  ADD COLUMN IF NOT EXISTS supabase_detection_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supabase_detection_scanned_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_vault_repositories_supabase_detected
  ON public.vault_repositories(user_id, supabase_detected, project_id);

COMMIT;
