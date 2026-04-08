import type { NotificationPreferences } from "@/features/notifications/types";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  browser_enabled: true,
  toast_enabled: true,
  meetings_enabled: true,
  meeting_follow_up_enabled: true,
  tasks_enabled: true,
  finance_enabled: true,
  meeting_reminder_minutes: [15, 5],
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  weekend_notifications: true,
  max_notifications_per_cycle: 3,
};

export const NOTIFICATION_REMINDER_OPTIONS = [30, 15, 5] as const;
export const NOTIFICATION_POLL_INTERVAL_MS = 60 * 1000;
