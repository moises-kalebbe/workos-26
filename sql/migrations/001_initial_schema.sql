-- ============================================
-- WorkOS 26 - PostgreSQL Schema
-- Adaptado para Clerk (sem auth.users)
-- user_id e profiles.id usam TEXT para Clerk IDs
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Core tables
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  client TEXT,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  status TEXT NOT NULL DEFAULT 'active',
  monthly_agreed_amount NUMERIC(10,2),
  monthly_agreed_hours NUMERIC(10,2),
  daily_agreed_hours NUMERIC(10,2),
  workdays TEXT[] NOT NULL DEFAULT '{}',
  daily_rate NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON time_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON time_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON time_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  skill_document_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  column_index INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  urgency TEXT NOT NULL DEFAULT 'not_urgent' CHECK (urgency IN ('urgent', 'not_urgent')),
  importance TEXT NOT NULL DEFAULT 'important' CHECK (importance IN ('important', 'not_important')),
  position INTEGER NOT NULL DEFAULT 0,
  client TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(user_id, column_index, position);
CREATE INDEX IF NOT EXISTS idx_tasks_eisenhower ON tasks(user_id, importance, urgency, column_index, position);

CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- ============================================
-- Agenda / Google Calendar
-- ============================================

CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda_event_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  series_key TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, series_key)
);

CREATE INDEX IF NOT EXISTS idx_agenda_event_metadata_user_series ON agenda_event_metadata(user_id, series_key);
CREATE INDEX IF NOT EXISTS idx_agenda_event_metadata_user_project ON agenda_event_metadata(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_agenda_event_metadata_tags_gin ON agenda_event_metadata USING GIN(tags);

CREATE TABLE IF NOT EXISTS agenda_preferences (
  user_id TEXT PRIMARY KEY,
  sort_mode TEXT NOT NULL DEFAULT 'priority_then_time' CHECK (sort_mode IN ('priority_then_time', 'time_only')),
  status_filter TEXT NOT NULL DEFAULT 'all' CHECK (status_filter IN ('all', 'pending', 'accepted', 'declined')),
  priority_filter TEXT[] NOT NULL DEFAULT '{}',
  tag_filter TEXT[] NOT NULL DEFAULT '{}',
  show_declined BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (priority_filter <@ ARRAY['urgent', 'high', 'normal', 'low'])
);

CREATE INDEX IF NOT EXISTS idx_agenda_preferences_user ON agenda_preferences(user_id);

-- ============================================
-- Skills library
-- ============================================

CREATE TABLE IF NOT EXISTS skill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_skill_categories_user_name ON skill_categories(user_id, name);

CREATE TABLE IF NOT EXISTS skill_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT,
  content_md TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'upload', 'seed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_downloaded_at TIMESTAMPTZ,
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_skill_documents_user_category ON skill_documents(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_skill_documents_user_project ON skill_documents(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_skill_documents_user_updated ON skill_documents(user_id, updated_at DESC);

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_skill_document_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_skill_document_id_fkey
  FOREIGN KEY (skill_document_id) REFERENCES skill_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_skill_document ON tasks(user_id, skill_document_id);

-- ============================================
-- Second Brain
-- ============================================

CREATE TABLE IF NOT EXISTS second_brain_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content_md TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'capture', 'windows-notes-import')),
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'note', 'archived')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_second_brain_notes_user_status_updated ON second_brain_notes(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_second_brain_notes_user_slug ON second_brain_notes(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_second_brain_notes_user_project_updated ON second_brain_notes(user_id, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_second_brain_notes_tags_gin ON second_brain_notes USING GIN(tags);

CREATE TABLE IF NOT EXISTS second_brain_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  source_note_id UUID NOT NULL REFERENCES second_brain_notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES second_brain_notes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('manual', 'wikilink')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_note_id <> target_note_id),
  UNIQUE (user_id, source_note_id, target_note_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_second_brain_links_user_source ON second_brain_links(user_id, source_note_id);
CREATE INDEX IF NOT EXISTS idx_second_brain_links_user_target ON second_brain_links(user_id, target_note_id);

-- ============================================
-- Vault Hub
-- ============================================

CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client TEXT,
  service TEXT,
  url TEXT,
  username TEXT,
  encrypted_password TEXT NOT NULL,
  iv TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_user ON vault_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_user_project ON vault_entries(user_id, project_id);

CREATE TABLE IF NOT EXISTS vault_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  local_path TEXT NOT NULL,
  remote_url TEXT,
  repo_name TEXT NOT NULL,
  owner_name TEXT,
  provider TEXT NOT NULL DEFAULT 'github',
  default_branch TEXT,
  detected_environment_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  last_scan_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_scan_status IN ('idle', 'success', 'error')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL DEFAULT 'local_scan' CHECK (source_type IN ('local_scan', 'github_sync')),
  external_id TEXT,
  html_url TEXT,
  is_remote_only BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, local_path),
  UNIQUE (user_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_repositories_user_project ON vault_repositories(user_id, project_id, repo_name);

CREATE TABLE IF NOT EXISTS vault_environment_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  repository_id UUID REFERENCES vault_repositories(id) ON DELETE CASCADE,
  env_key TEXT NOT NULL,
  env_scope TEXT NOT NULL DEFAULT 'unknown' CHECK (env_scope IN ('local', 'development', 'production', 'staging', 'unknown')),
  source_path TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  detected_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, repository_id, env_key, source_path)
);

CREATE INDEX IF NOT EXISTS idx_vault_environment_entries_user_repo ON vault_environment_entries(user_id, repository_id, env_scope);

CREATE TABLE IF NOT EXISTS vault_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  repository_id UUID REFERENCES vault_repositories(id) ON DELETE SET NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('repo_scan', 'env_scan', 'windows_notes_import', 'github_sync')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  summary TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_sync_runs_user_created ON vault_sync_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vault_github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'GitHub principal',
  encrypted_token TEXT NOT NULL,
  iv TEXT NOT NULL,
  github_user_id TEXT,
  github_login TEXT NOT NULL,
  github_name TEXT,
  avatar_url TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, github_login)
);

CREATE INDEX IF NOT EXISTS idx_vault_github_connections_user_active ON vault_github_connections(user_id, is_active, github_login);

-- ============================================
-- Functions and triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.column_index = 2 AND (OLD.column_index IS NULL OR OLD.column_index != 2) THEN
    NEW.completed_at = NOW();
  ELSIF NEW.column_index != 2 THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_second_brain_link_ownership()
RETURNS TRIGGER AS $$
DECLARE
  source_owner TEXT;
  target_owner TEXT;
BEGIN
  SELECT user_id INTO source_owner
  FROM second_brain_notes
  WHERE id = NEW.source_note_id;

  SELECT user_id INTO target_owner
  FROM second_brain_notes
  WHERE id = NEW.target_note_id;

  IF source_owner IS NULL OR target_owner IS NULL THEN
    RAISE EXCEPTION 'Source or target note does not exist';
  END IF;

  IF NEW.user_id IS DISTINCT FROM source_owner OR NEW.user_id IS DISTINCT FROM target_owner THEN
    RAISE EXCEPTION 'Link ownership mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profiles_updated ON profiles;
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_projects_updated ON projects;
CREATE TRIGGER tr_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_tasks_updated ON tasks;
CREATE TRIGGER tr_tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_task_completed ON tasks;
CREATE TRIGGER tr_task_completed BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_completed_at();

DROP TRIGGER IF EXISTS update_google_tokens_updated_at ON google_tokens;
CREATE TRIGGER update_google_tokens_updated_at BEFORE UPDATE ON google_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_agenda_event_metadata_updated ON agenda_event_metadata;
CREATE TRIGGER tr_agenda_event_metadata_updated BEFORE UPDATE ON agenda_event_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_agenda_preferences_updated ON agenda_preferences;
CREATE TRIGGER tr_agenda_preferences_updated BEFORE UPDATE ON agenda_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_skill_categories_updated ON skill_categories;
CREATE TRIGGER tr_skill_categories_updated BEFORE UPDATE ON skill_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_skill_documents_updated ON skill_documents;
CREATE TRIGGER tr_skill_documents_updated BEFORE UPDATE ON skill_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_second_brain_notes_updated ON second_brain_notes;
CREATE TRIGGER tr_second_brain_notes_updated BEFORE UPDATE ON second_brain_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_second_brain_links_validate_ownership ON second_brain_links;
CREATE TRIGGER tr_second_brain_links_validate_ownership BEFORE INSERT OR UPDATE ON second_brain_links FOR EACH ROW EXECUTE FUNCTION validate_second_brain_link_ownership();

DROP TRIGGER IF EXISTS tr_vault_updated ON vault_entries;
CREATE TRIGGER tr_vault_updated BEFORE UPDATE ON vault_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_vault_repositories_updated ON vault_repositories;
CREATE TRIGGER tr_vault_repositories_updated BEFORE UPDATE ON vault_repositories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_vault_environment_entries_updated ON vault_environment_entries;
CREATE TRIGGER tr_vault_environment_entries_updated BEFORE UPDATE ON vault_environment_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_vault_github_connections_updated ON vault_github_connections;
CREATE TRIGGER tr_vault_github_connections_updated BEFORE UPDATE ON vault_github_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
