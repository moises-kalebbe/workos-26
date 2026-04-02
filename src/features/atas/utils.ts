import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { MeetingMinutesItem, MeetingMinutesStatus } from "@/types";

export const MEETING_MINUTES_STATUS_LABEL: Record<MeetingMinutesStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  resolved: "Resolvido",
};

export const MEETING_MINUTES_STATUS_ORDER: Record<MeetingMinutesStatus, number> = {
  pending: 0,
  in_progress: 1,
  resolved: 2,
};

export type MeetingMinutesMeetingOption = Pick<
  CalendarEvent,
  "id" | "seriesKey" | "summary" | "start" | "allDay"
>;

export type MeetingMinutesFilters = {
  search: string;
  status: "all" | MeetingMinutesStatus;
  meetingEventId: string | null;
};

export function normalizeMeetingMinutesStatus(
  value: string | null | undefined,
): MeetingMinutesStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return "pending";
}

export function normalizeMeetingMinutesItem(
  item: Omit<MeetingMinutesItem, "status"> & { status: string | null | undefined },
): MeetingMinutesItem {
  return {
    ...item,
    status: normalizeMeetingMinutesStatus(item.status),
    detail: item.detail || null,
    completed_at: item.completed_at || null,
  };
}

export function buildMeetingMinutesSummary(items: MeetingMinutesItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    {
      pending: 0,
      in_progress: 0,
      resolved: 0,
    },
  );
}

export function sortMeetingMinutes(items: MeetingMinutesItem[]) {
  return [...items].sort((a, b) => {
    const statusDiff =
      MEETING_MINUTES_STATUS_ORDER[a.status] - MEETING_MINUTES_STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    const completedDiff =
      new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime();
    if (completedDiff !== 0) return completedDiff;

    const meetingDiff =
      new Date(b.meeting_start_at).getTime() - new Date(a.meeting_start_at).getTime();
    if (meetingDiff !== 0) return meetingDiff;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function filterMeetingMinutes(
  items: MeetingMinutesItem[],
  filters: MeetingMinutesFilters,
) {
  const search = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    if (filters.meetingEventId && item.meeting_event_id !== filters.meetingEventId) {
      return false;
    }

    if (!search) return true;

    const haystack = [
      item.title,
      item.detail || "",
      item.meeting_summary,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function buildMeetingMinutesMeetingOptions(
  events: CalendarEvent[],
  items: MeetingMinutesItem[],
) {
  const options = new Map<string, MeetingMinutesMeetingOption>();

  for (const event of events) {
    options.set(event.id, {
      id: event.id,
      seriesKey: event.seriesKey,
      summary: event.summary,
      start: event.start,
      allDay: event.allDay,
    });
  }

  for (const item of items) {
    if (options.has(item.meeting_event_id)) continue;
    options.set(item.meeting_event_id, {
      id: item.meeting_event_id,
      seriesKey: item.meeting_series_key,
      summary: item.meeting_summary,
      start: item.meeting_start_at,
      allDay: false,
    });
  }

  return [...options.values()].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
  );
}

export function applyMeetingMinutesStatus(
  item: MeetingMinutesItem,
  status: MeetingMinutesStatus,
  nowIso: string,
): MeetingMinutesItem {
  return {
    ...item,
    status,
    completed_at: status === "resolved" ? nowIso : null,
  };
}
