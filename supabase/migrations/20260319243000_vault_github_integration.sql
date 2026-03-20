BEGIN;

ALTER TABLE public.vault_repositories
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'local_scan'
    CHECK (source_type IN ('local_scan', 'github_sync')),
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS html_url text,
  ADD COLUMN IF NOT EXISTS is_remote_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.vault_repositories
  DROP CONSTRAINT IF EXISTS vault_repositories_source_type_check;

ALTER TABLE public.vault_repositories
  ADD CONSTRAINT vault_repositories_source_type_check
  CHECK (source_type IN ('local_scan', 'github_sync'));

ALTER TABLE public.vault_sync_runs
  DROP CONSTRAINT IF EXISTS vault_sync_runs_run_type_check;

ALTER TABLE public.vault_sync_runs
  ADD CONSTRAINT vault_sync_runs_run_type_check
  CHECK (run_type IN ('repo_scan', 'env_scan', 'keepalive', 'windows_notes_import', 'github_sync'));

ALTER TABLE public.vault_repositories
  DROP CONSTRAINT IF EXISTS vault_repositories_user_provider_external_key;

ALTER TABLE public.vault_repositories
  ADD CONSTRAINT vault_repositories_user_provider_external_key
  UNIQUE (user_id, provider, external_id);

CREATE TABLE IF NOT EXISTS public.vault_github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'GitHub principal',
  encrypted_token text NOT NULL,
  iv text NOT NULL,
  github_user_id text,
  github_login text NOT NULL,
  github_name text,
  avatar_url text,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamp with time zone,
  last_sync_status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, github_login)
);

CREATE INDEX IF NOT EXISTS idx_vault_github_connections_user_active
  ON public.vault_github_connections(user_id, is_active, github_login);

ALTER TABLE public.vault_github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault github connections own data"
ON public.vault_github_connections
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS tr_vault_github_connections_updated ON public.vault_github_connections;
CREATE TRIGGER tr_vault_github_connections_updated
BEFORE UPDATE ON public.vault_github_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

COMMIT;
