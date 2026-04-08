import { describe, expect, it } from "vitest";
import type { DashboardAttentionItem } from "@/features/dashboard/types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/features/notifications/defaults";
import {
  buildNotificationCandidates,
  getNotificationSuppressionState,
  normalizeNotificationPreferences,
} from "@/features/notifications/utils";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";

function makeQueueItem(overrides: Partial<DashboardAttentionItem> = {}): DashboardAttentionItem {
  return {
    id: "finance:1:upcoming",
    type: "finance_upcoming",
    rank: 1,
    eyebrow: "Vencimento proximo",
    title: "Fatura AWS",
    description: "Pagamento em 2d (10/04).",
    tone: "warning",
    badgeLabel: "Financeiro",
    projectId: null,
    projectName: null,
    primaryAction: {
      kind: "open_financeiro",
      label: "Abrir financeiro",
      href: "/financeiro",
    },
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    seriesKey: "series-1",
    recurringEventId: null,
    iCalUID: null,
    summary: "Weekly sync",
    description: null,
    location: null,
    start: "2026-04-08T13:15:00.000Z",
    end: "2026-04-08T14:00:00.000Z",
    allDay: false,
    htmlLink: "https://calendar.google.com/event-1",
    meetLink: "https://meet.google.com/abc-defg-hij",
    status: "confirmed",
    colorId: null,
    priority: "normal",
    tags: [],
    projectId: null,
    projectName: null,
    selfResponseStatus: "accepted",
    canRespond: true,
    isOrganizer: false,
    ...overrides,
  };
}

describe("notification utils", () => {
  it("normalizes preferences with defaults and sanitized reminders", () => {
    const normalized = normalizeNotificationPreferences({
      enabled: false,
      meeting_reminder_minutes: [5, 15, 15, 999, "30"],
      max_notifications_per_cycle: 5,
    });

    expect(normalized.enabled).toBe(false);
    expect(normalized.meeting_reminder_minutes).toEqual([30, 15, 5]);
    expect(normalized.max_notifications_per_cycle).toBe(5);
    expect(normalized.tasks_enabled).toBe(DEFAULT_NOTIFICATION_PREFERENCES.tasks_enabled);
  });

  it("suppresses notifications inside quiet hours crossing midnight", () => {
    const suppressed = getNotificationSuppressionState(
      new Date("2026-04-08T07:30:00.000Z"),
      "America/Sao_Paulo",
      {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        quiet_hours_enabled: true,
        quiet_hours_start: "22:00",
        quiet_hours_end: "07:00",
      },
    );

    expect(suppressed.quietHours).toBe(true);
  });

  it("builds meeting reminder candidates inside the polling window", () => {
    const result = buildNotificationCandidates({
      now: new Date("2026-04-08T13:00:10.000Z"),
      timezone: "America/Sao_Paulo",
      pollWindowMs: 60 * 1000,
      attentionQueue: [],
      calendarEvents: [makeEvent()],
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    });

    expect(result.candidates.some((candidate) => candidate.key === "meeting-reminder:event-1:15")).toBe(true);
  });

  it("maps attention queue items into candidates by enabled category", () => {
    const result = buildNotificationCandidates({
      now: new Date("2026-04-08T13:00:10.000Z"),
      timezone: "America/Sao_Paulo",
      pollWindowMs: 60 * 1000,
      attentionQueue: [
        makeQueueItem(),
        makeQueueItem({
          id: "task:1:today",
          type: "task_due_today",
          title: "Entregar proposta",
        }),
      ],
      calendarEvents: [],
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        finance_enabled: true,
        tasks_enabled: false,
      },
    });

    expect(result.candidates.map((candidate) => candidate.key)).toContain("queue:finance:1:upcoming");
    expect(result.candidates.map((candidate) => candidate.key)).not.toContain("queue:task:1:today");
  });
});
