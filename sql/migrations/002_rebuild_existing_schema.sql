-- ============================================
-- WorkOS 26 - Rebuild existing schema
-- Use this only when the database is empty or disposable.
-- ============================================

DROP TABLE IF EXISTS vault_sync_runs CASCADE;
DROP TABLE IF EXISTS vault_environment_entries CASCADE;
DROP TABLE IF EXISTS vault_github_connections CASCADE;
DROP TABLE IF EXISTS vault_repositories CASCADE;
DROP TABLE IF EXISTS vault_entries CASCADE;
DROP TABLE IF EXISTS second_brain_links CASCADE;
DROP TABLE IF EXISTS second_brain_notes CASCADE;
DROP TABLE IF EXISTS skill_documents CASCADE;
DROP TABLE IF EXISTS skill_categories CASCADE;
DROP TABLE IF EXISTS agenda_event_metadata CASCADE;
DROP TABLE IF EXISTS agenda_preferences CASCADE;
DROP TABLE IF EXISTS google_tokens CASCADE;
DROP TABLE IF EXISTS subtasks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS time_sessions CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP FUNCTION IF EXISTS validate_second_brain_link_ownership() CASCADE;
DROP FUNCTION IF EXISTS set_completed_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
