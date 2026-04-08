import type { DashboardAttentionItem, DashboardAttentionTone } from "@/features/dashboard/types";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";

export type NotificationPermissionState = NotificationPermission | "unsupported";

export interface NotificationPreferences {
  enabled: boolean;
  browser_enabled: boolean;
  toast_enabled: boolean;
  meetings_enabled: boolean;
  meeting_follow_up_enabled: boolean;
  tasks_enabled: boolean;
  finance_enabled: boolean;
  meeting_reminder_minutes: number[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  weekend_notifications: boolean;
  max_notifications_per_cycle: number;
}

export interface NotificationCandidate {
  key: string;
  title: string;
  description: string;
  tone: DashboardAttentionTone;
  href: string | null;
  external: boolean;
  source: "meeting_reminder" | "meeting_live" | "attention_queue";
  sourceId: string;
}

export interface NotificationSuppressionState {
  quietHours: boolean;
  weekend: boolean;
}

export interface BuildNotificationCandidatesInput {
  now: Date;
  timezone: string;
  pollWindowMs: number;
  attentionQueue: DashboardAttentionItem[];
  calendarEvents: CalendarEvent[];
  preferences: NotificationPreferences;
}
