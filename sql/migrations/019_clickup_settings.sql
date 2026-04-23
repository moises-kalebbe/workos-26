-- 019: ClickUp integration fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clickup_token TEXT,
  ADD COLUMN IF NOT EXISTS clickup_view_id TEXT;
