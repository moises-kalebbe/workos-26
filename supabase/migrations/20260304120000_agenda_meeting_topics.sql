BEGIN;

CREATE TABLE IF NOT EXISTS public.agenda_meeting_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_event_id text NOT NULL,
  meeting_series_key text NOT NULL,
  meeting_start_at timestamp with time zone NOT NULL,
  meeting_summary text NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  detail text NOT NULL DEFAULT '',
  conclusion text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'resolved')),
  carried_from_topic_id uuid REFERENCES public.agenda_meeting_topics(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_meeting
  ON public.agenda_meeting_topics(user_id, meeting_event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_series
  ON public.agenda_meeting_topics(user_id, meeting_series_key, meeting_start_at);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_status
  ON public.agenda_meeting_topics(user_id, status);

ALTER TABLE public.agenda_meeting_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agenda meeting topics own data"
ON public.agenda_meeting_topics
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS tr_agenda_meeting_topics_updated ON public.agenda_meeting_topics;
CREATE TRIGGER tr_agenda_meeting_topics_updated
BEFORE UPDATE ON public.agenda_meeting_topics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

COMMIT;
