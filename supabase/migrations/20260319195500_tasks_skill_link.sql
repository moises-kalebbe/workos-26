BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS skill_document_id uuid REFERENCES public.skill_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_skill_document
  ON public.tasks(user_id, skill_document_id);

COMMIT;
