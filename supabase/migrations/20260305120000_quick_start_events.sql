BEGIN;

CREATE TABLE IF NOT EXISTS public.quick_start_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_start_events_user_created
  ON public.quick_start_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quick_start_events_name_created
  ON public.quick_start_events(event_name, created_at DESC);

ALTER TABLE public.quick_start_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quick start events own data" ON public.quick_start_events;
CREATE POLICY "Quick start events own data"
  ON public.quick_start_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;

