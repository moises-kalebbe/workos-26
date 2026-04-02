ALTER TABLE agenda_meeting_topics
ADD COLUMN IF NOT EXISTS checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb;

