CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  browser_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  toast_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  meetings_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  meeting_follow_up_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tasks_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  finance_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  meeting_reminder_minutes INTEGER[] NOT NULL DEFAULT '{15,5}'::integer[],
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  weekend_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  max_notifications_per_cycle INTEGER NOT NULL DEFAULT 3 CHECK (max_notifications_per_cycle >= 1 AND max_notifications_per_cycle <= 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    meeting_reminder_minutes <@ ARRAY[
      1, 5, 10, 15, 30, 45, 60, 90, 120
    ]
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences(user_id);

DROP TRIGGER IF EXISTS tr_notification_preferences_updated ON notification_preferences;
CREATE TRIGGER tr_notification_preferences_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
