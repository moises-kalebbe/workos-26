BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS importance text;

UPDATE public.tasks
SET
  urgency = CASE
    WHEN COALESCE(priority, 'normal') = 'urgent' THEN 'urgent'
    WHEN due_date IS NOT NULL AND due_date <= (now() AT TIME ZONE 'UTC')::date THEN 'urgent'
    ELSE 'not_urgent'
  END,
  importance = CASE
    WHEN COALESCE(priority, 'normal') IN ('urgent', 'high', 'normal') THEN 'important'
    ELSE 'not_important'
  END
WHERE urgency IS NULL OR importance IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN urgency SET DEFAULT 'not_urgent',
  ALTER COLUMN urgency SET NOT NULL,
  ALTER COLUMN importance SET DEFAULT 'important',
  ALTER COLUMN importance SET NOT NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_urgency_check,
  ADD CONSTRAINT tasks_urgency_check CHECK (urgency IN ('urgent', 'not_urgent')),
  DROP CONSTRAINT IF EXISTS tasks_importance_check,
  ADD CONSTRAINT tasks_importance_check CHECK (importance IN ('important', 'not_important'));

CREATE INDEX IF NOT EXISTS idx_tasks_eisenhower
  ON public.tasks (user_id, importance, urgency, column_index, position);

COMMIT;
