BEGIN;

ALTER TABLE public.skill_documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_skill_documents_user_project
  ON public.skill_documents(user_id, project_id);

ALTER TABLE public.second_brain_notes
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_second_brain_notes_user_project_updated
  ON public.second_brain_notes(user_id, project_id, updated_at DESC);

ALTER TABLE public.vault_entries
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.vault_entries
  ALTER COLUMN client DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_entries_user_project
  ON public.vault_entries(user_id, project_id);

ALTER TABLE public.agenda_event_metadata
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_event_metadata_user_project
  ON public.agenda_event_metadata(user_id, project_id);

UPDATE public.tasks AS t
SET project_id = p.id
FROM public.projects AS p
WHERE t.user_id = p.user_id
  AND t.project_id IS NULL
  AND t.client IS NOT NULL
  AND lower(trim(t.client)) = lower(trim(p.name));

UPDATE public.vault_entries AS v
SET project_id = p.id
FROM public.projects AS p
WHERE v.user_id = p.user_id
  AND v.project_id IS NULL
  AND v.client IS NOT NULL
  AND lower(trim(v.client)) = lower(trim(p.name));

UPDATE public.tasks AS t
SET client = p.name
FROM public.projects AS p
WHERE t.project_id = p.id
  AND (t.client IS NULL OR length(trim(t.client)) = 0);

UPDATE public.vault_entries AS v
SET client = p.name
FROM public.projects AS p
WHERE v.project_id = p.id
  AND (v.client IS NULL OR length(trim(v.client)) = 0);

COMMIT;
