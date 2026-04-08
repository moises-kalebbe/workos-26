import type { DashboardAttentionItem } from "@/features/dashboard/types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/features/notifications/defaults";
import type {
  BuildNotificationCandidatesInput,
  NotificationCandidate,
  NotificationPreferences,
  NotificationSuppressionState,
} from "@/features/notifications/types";

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeReminderMinutes(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_NOTIFICATION_PREFERENCES.meeting_reminder_minutes;
  }

  const normalized = [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0 && item <= 120),
  )].sort((left, right) => right - left);

  return normalized.length > 0
    ? normalized
    : DEFAULT_NOTIFICATION_PREFERENCES.meeting_reminder_minutes;
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^\d{2}:\d{2}/.test(normalized) ? normalized.slice(0, 5) : fallback;
}

export function normalizeNotificationPreferences(raw: Record<string, unknown> | null | undefined): NotificationPreferences {
  if (!raw) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const maxPerCycle = Number(raw.max_notifications_per_cycle);

  return {
    enabled: toBoolean(raw.enabled, DEFAULT_NOTIFICATION_PREFERENCES.enabled),
    browser_enabled: toBoolean(raw.browser_enabled, DEFAULT_NOTIFICATION_PREFERENCES.browser_enabled),
    toast_enabled: toBoolean(raw.toast_enabled, DEFAULT_NOTIFICATION_PREFERENCES.toast_enabled),
    meetings_enabled: toBoolean(raw.meetings_enabled, DEFAULT_NOTIFICATION_PREFERENCES.meetings_enabled),
    meeting_follow_up_enabled: toBoolean(raw.meeting_follow_up_enabled, DEFAULT_NOTIFICATION_PREFERENCES.meeting_follow_up_enabled),
    tasks_enabled: toBoolean(raw.tasks_enabled, DEFAULT_NOTIFICATION_PREFERENCES.tasks_enabled),
    finance_enabled: toBoolean(raw.finance_enabled, DEFAULT_NOTIFICATION_PREFERENCES.finance_enabled),
    meeting_reminder_minutes: normalizeReminderMinutes(raw.meeting_reminder_minutes),
    quiet_hours_enabled: toBoolean(raw.quiet_hours_enabled, DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_enabled),
    quiet_hours_start: normalizeTime(raw.quiet_hours_start, DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_start),
    quiet_hours_end: normalizeTime(raw.quiet_hours_end, DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_end),
    weekend_notifications: toBoolean(raw.weekend_notifications, DEFAULT_NOTIFICATION_PREFERENCES.weekend_notifications),
    max_notifications_per_cycle:
      Number.isInteger(maxPerCycle) && maxPerCycle >= 1 && maxPerCycle <= 10
        ? maxPerCycle
        : DEFAULT_NOTIFICATION_PREFERENCES.max_notifications_per_cycle,
  };
}

function getTimezoneParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    weekday: values.get("weekday") || "Mon",
    hour: Number(values.get("hour") || "0"),
    minute: Number(values.get("minute") || "0"),
  };
}

function getMinutesFromTimeString(value: string) {
  const [hour, minute] = value.split(":").map((item) => Number(item));
  return hour * 60 + minute;
}

export function getNotificationSuppressionState(
  now: Date,
  timezone: string,
  preferences: NotificationPreferences,
): NotificationSuppressionState {
  const parts = getTimezoneParts(now, timezone);
  const isWeekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  const minutesNow = parts.hour * 60 + parts.minute;
  const quietStart = getMinutesFromTimeString(preferences.quiet_hours_start);
  const quietEnd = getMinutesFromTimeString(preferences.quiet_hours_end);

  let quietHours = false;
  if (preferences.quiet_hours_enabled) {
    if (quietStart === quietEnd) {
      quietHours = true;
    } else if (quietStart < quietEnd) {
      quietHours = minutesNow >= quietStart && minutesNow < quietEnd;
    } else {
      quietHours = minutesNow >= quietStart || minutesNow < quietEnd;
    }
  }

  return {
    quietHours,
    weekend: !preferences.weekend_notifications && isWeekend,
  };
}

function formatTime(dateIso: string, timezone: string) {
  return new Date(dateIso).toLocaleTimeString("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isQueueItemEnabled(item: DashboardAttentionItem, preferences: NotificationPreferences) {
  switch (item.type) {
    case "finance_overdue":
    case "finance_upcoming":
      return preferences.finance_enabled;
    case "task_overdue":
    case "task_due_today":
    case "task_stale_in_progress":
      return preferences.tasks_enabled;
    case "meeting_missing_minutes":
    case "meeting_minutes_pending":
      return preferences.meeting_follow_up_enabled;
    default:
      return false;
  }
}

function getQueueItemHref(item: DashboardAttentionItem) {
  const primary = item.primaryAction.href;
  if (primary) {
    return {
      href: primary,
      external: Boolean(item.primaryAction.external),
    };
  }

  if (item.secondaryAction?.href) {
    return {
      href: item.secondaryAction.href,
      external: Boolean(item.secondaryAction.external),
    };
  }

  return {
    href: null,
    external: false,
  };
}

function mapQueueItemsToCandidates(
  attentionQueue: DashboardAttentionItem[],
  preferences: NotificationPreferences,
): NotificationCandidate[] {
  return attentionQueue
    .filter((item) => isQueueItemEnabled(item, preferences))
    .map((item) => {
      const target = getQueueItemHref(item);
      return {
        key: `queue:${item.id}`,
        title: item.title,
        description: item.description,
        tone: item.tone,
        href: target.href,
        external: target.external,
        source: "attention_queue",
        sourceId: item.id,
      } satisfies NotificationCandidate;
    });
}

function buildMeetingReminderCandidates(input: BuildNotificationCandidatesInput) {
  if (!input.preferences.meetings_enabled) {
    return [] as NotificationCandidate[];
  }

  const nowMs = input.now.getTime();
  const candidates: NotificationCandidate[] = [];

  for (const event of input.calendarEvents) {
    if (event.allDay || event.selfResponseStatus === "declined") continue;

    const startMs = new Date(event.start).getTime();
    const endMs = new Date(event.end).getTime();
    const startsInMs = startMs - nowMs;

    for (const reminderMinutes of input.preferences.meeting_reminder_minutes) {
      const reminderWindowEnd = reminderMinutes * 60 * 1000;
      const reminderWindowStart = reminderWindowEnd - input.pollWindowMs;

      if (startsInMs <= reminderWindowEnd && startsInMs > reminderWindowStart) {
        candidates.push({
          key: `meeting-reminder:${event.id}:${reminderMinutes}`,
          title: `Reuniao em ${reminderMinutes} min`,
          description: `${event.summary} com inicio as ${formatTime(event.start, input.timezone)}.`,
          tone: reminderMinutes <= 5 ? "danger" : "warning",
          href: event.meetLink || event.htmlLink || "/agenda?preset=today",
          external: Boolean(event.meetLink || event.htmlLink),
          source: "meeting_reminder",
          sourceId: event.id,
        });
      }
    }

    if (startsInMs <= 0 && endMs > nowMs && nowMs - startMs <= input.pollWindowMs) {
      candidates.push({
        key: `meeting-live:${event.id}`,
        title: "Reuniao acontecendo agora",
        description: `${event.summary} ja comecou. Abra para entrar ou registrar a ata.`,
        tone: "danger",
        href: event.meetLink || `/atas?meeting=${encodeURIComponent(event.id)}`,
        external: Boolean(event.meetLink),
        source: "meeting_live",
        sourceId: event.id,
      });
    }
  }

  return candidates;
}

export function buildNotificationCandidates(input: BuildNotificationCandidatesInput) {
  const suppressed = getNotificationSuppressionState(input.now, input.timezone, input.preferences);

  return {
    candidates: [
      ...buildMeetingReminderCandidates(input),
      ...mapQueueItemsToCandidates(input.attentionQueue, input.preferences),
    ],
    suppressed,
  };
}
