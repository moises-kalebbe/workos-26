ALTER TABLE daily_reflection_entries
ADD COLUMN IF NOT EXISTS checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE daily_reflection_entries
ADD COLUMN IF NOT EXISTS tomorrow_focus TEXT NOT NULL DEFAULT '';
