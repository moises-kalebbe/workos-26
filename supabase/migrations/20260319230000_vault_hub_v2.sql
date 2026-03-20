BEGIN;

ALTER TABLE public.second_brain_notes
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.second_brain_notes
  DROP CONSTRAINT IF EXISTS second_brain_notes_source_type_check;

ALTER TABLE public.second_brain_notes
  ADD CONSTRAINT second_brain_notes_source_type_check
  CHECK (source_type IN ('manual', 'capture', 'windows-notes-import'));

CREATE TABLE IF NOT EXISTS public.vault_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  local_path text NOT NULL,
  remote_url text,
  repo_name text NOT NULL,
  owner_name text,
  provider text NOT NULL DEFAULT 'github',
  default_branch text,
  detected_environment_count integer NOT NULL DEFAULT 0,
  last_scanned_at timestamp with time zone,
  last_scan_status text NOT NULL DEFAULT 'idle'
    CHECK (last_scan_status IN ('idle', 'success', 'error')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_path)
);

CREATE INDEX IF NOT EXISTS idx_vault_repositories_user_project
  ON public.vault_repositories(user_id, project_id, repo_name);

ALTER TABLE public.vault_repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault repositories own data"
ON public.vault_repositories
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.vault_environment_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  repository_id uuid REFERENCES public.vault_repositories(id) ON DELETE CASCADE,
  env_key text NOT NULL,
  env_scope text NOT NULL DEFAULT 'unknown'
    CHECK (env_scope IN ('local', 'development', 'production', 'staging', 'unknown')),
  source_path text NOT NULL,
  encrypted_value text NOT NULL,
  iv text NOT NULL,
  detected_provider text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, repository_id, env_key, source_path)
);

CREATE INDEX IF NOT EXISTS idx_vault_environment_entries_user_repo
  ON public.vault_environment_entries(user_id, repository_id, env_scope);

ALTER TABLE public.vault_environment_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault environment entries own data"
ON public.vault_environment_entries
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.vault_supabase_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  repository_id uuid REFERENCES public.vault_repositories(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  project_ref text,
  project_url text,
  api_url text,
  keepalive_type text NOT NULL DEFAULT 'rest'
    CHECK (keepalive_type IN ('rest', 'sql')),
  keepalive_enabled boolean NOT NULL DEFAULT false,
  keepalive_interval_hours integer NOT NULL DEFAULT 72,
  encrypted_credential text,
  credential_iv text,
  last_keepalive_at timestamp with time zone,
  last_keepalive_status text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_supabase_instances_user_project
  ON public.vault_supabase_instances(user_id, project_id, keepalive_enabled);

ALTER TABLE public.vault_supabase_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault supabase instances own data"
ON public.vault_supabase_instances
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.vault_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  repository_id uuid REFERENCES public.vault_repositories(id) ON DELETE SET NULL,
  supabase_instance_id uuid REFERENCES public.vault_supabase_instances(id) ON DELETE SET NULL,
  run_type text NOT NULL
    CHECK (run_type IN ('repo_scan', 'env_scan', 'keepalive', 'windows_notes_import')),
  status text NOT NULL
    CHECK (status IN ('success', 'error', 'skipped')),
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_sync_runs_user_created
  ON public.vault_sync_runs(user_id, created_at DESC);

ALTER TABLE public.vault_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vault sync runs own data"
ON public.vault_sync_runs
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS tr_vault_repositories_updated ON public.vault_repositories;
CREATE TRIGGER tr_vault_repositories_updated
BEFORE UPDATE ON public.vault_repositories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tr_vault_environment_entries_updated ON public.vault_environment_entries;
CREATE TRIGGER tr_vault_environment_entries_updated
BEFORE UPDATE ON public.vault_environment_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tr_vault_supabase_instances_updated ON public.vault_supabase_instances;
CREATE TRIGGER tr_vault_supabase_instances_updated
BEFORE UPDATE ON public.vault_supabase_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

COMMIT;
