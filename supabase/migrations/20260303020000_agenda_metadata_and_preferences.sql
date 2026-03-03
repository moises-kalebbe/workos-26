CREATE TABLE public.agenda_event_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_key text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, series_key)
);

CREATE INDEX idx_agenda_event_metadata_user_series
  ON public.agenda_event_metadata(user_id, series_key);

CREATE INDEX idx_agenda_event_metadata_tags_gin
  ON public.agenda_event_metadata
  USING GIN(tags);

ALTER TABLE public.agenda_event_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agenda metadata own data"
ON public.agenda_event_metadata
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tr_agenda_event_metadata_updated
BEFORE UPDATE ON public.agenda_event_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.agenda_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_mode text NOT NULL DEFAULT 'priority_then_time'
    CHECK (sort_mode IN ('priority_then_time', 'time_only')),
  status_filter text NOT NULL DEFAULT 'all'
    CHECK (status_filter IN ('all', 'pending', 'accepted', 'declined')),
  priority_filter text[] NOT NULL DEFAULT '{}'
    CHECK (priority_filter <@ ARRAY['urgent', 'high', 'normal', 'low']),
  tag_filter text[] NOT NULL DEFAULT '{}',
  show_declined boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_agenda_preferences_user
  ON public.agenda_preferences(user_id);

ALTER TABLE public.agenda_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agenda preferences own data"
ON public.agenda_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER tr_agenda_preferences_updated
BEFORE UPDATE ON public.agenda_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
