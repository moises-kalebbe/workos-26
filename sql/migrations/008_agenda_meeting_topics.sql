CREATE TABLE IF NOT EXISTS agenda_meeting_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  meeting_event_id TEXT NOT NULL,
  meeting_series_key TEXT NOT NULL,
  meeting_start_at TIMESTAMPTZ NOT NULL,
  meeting_summary TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_created
  ON agenda_meeting_topics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_meeting
  ON agenda_meeting_topics(user_id, meeting_event_id, meeting_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting_topics_user_status
  ON agenda_meeting_topics(user_id, status, meeting_start_at DESC);

DROP TRIGGER IF EXISTS tr_agenda_meeting_topics_updated ON agenda_meeting_topics;
CREATE TRIGGER tr_agenda_meeting_topics_updated
  BEFORE UPDATE ON agenda_meeting_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
