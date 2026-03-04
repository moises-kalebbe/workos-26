BEGIN;

ALTER TABLE public.agenda_meeting_topics
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_project
  ON public.agenda_meeting_topics(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_tags_gin
  ON public.agenda_meeting_topics USING gin(tags);

COMMIT;
