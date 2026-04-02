import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { MeetingMinutesItem } from "@/types";
import {
  applyMeetingMinutesStatus,
  buildMeetingMinutesMeetingOptions,
  buildMeetingMinutesSummary,
  filterMeetingMinutes,
  sortMeetingMinutes,
} from "@/features/atas/utils";

const baseItem = (overrides: Partial<MeetingMinutesItem>): MeetingMinutesItem => ({
  id: "item-1",
  user_id: "user_1",
  meeting_event_id: "meeting-1",
  meeting_series_key: "series-1",
  meeting_start_at: "2026-03-31T13:00:00.000Z",
  meeting_summary: "Weekly sync",
  title: "Confirmar pendencia",
  detail: null,
  status: "pending",
  completed_at: null,
  created_at: "2026-03-31T13:05:00.000Z",
  updated_at: "2026-03-31T13:05:00.000Z",
  ...overrides,
});

describe("meeting minutes utils", () => {
  it("builds dashboard summary by status", () => {
    const summary = buildMeetingMinutesSummary([
      baseItem({ status: "pending" }),
      baseItem({ id: "2", status: "in_progress" }),
      baseItem({ id: "3", status: "resolved" }),
      baseItem({ id: "4", status: "resolved" }),
    ]);

    expect(summary).toEqual({
      pending: 1,
      in_progress: 1,
      resolved: 2,
    });
  });

  it("filters by search, status and meeting id", () => {
    const items = [
      baseItem({ title: "Enviar proposta", meeting_event_id: "meeting-a" }),
      baseItem({
        id: "2",
        title: "Fechar contrato",
        detail: "Alinhar comercial",
        meeting_event_id: "meeting-b",
        status: "in_progress",
      }),
    ];

    const filtered = filterMeetingMinutes(items, {
      search: "comercial",
      status: "in_progress",
      meetingEventId: "meeting-b",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("2");
  });

  it("sorts unresolved items first and resolved items last", () => {
    const items = sortMeetingMinutes([
      baseItem({
        id: "resolved",
        status: "resolved",
        completed_at: "2026-04-01T11:00:00.000Z",
      }),
      baseItem({
        id: "in-progress",
        status: "in_progress",
      }),
      baseItem({
        id: "pending",
        status: "pending",
      }),
    ]);

    expect(items.map((item) => item.id)).toEqual(["pending", "in-progress", "resolved"]);
  });

  it("keeps meeting snapshots when calendar does not return the old meeting", () => {
    const events: CalendarEvent[] = [
      {
        id: "meeting-live",
        seriesKey: "series-live",
        recurringEventId: null,
        iCalUID: null,
        summary: "Current sync",
        description: null,
        location: null,
        start: "2026-04-01T13:00:00.000Z",
        end: "2026-04-01T14:00:00.000Z",
        allDay: false,
        htmlLink: "https://example.com",
        meetLink: null,
        status: "confirmed",
        colorId: null,
        priority: "normal",
        tags: [],
        projectId: null,
        projectName: null,
        selfResponseStatus: "accepted",
        canRespond: true,
        isOrganizer: false,
      },
    ];

    const items = [
      baseItem({
        meeting_event_id: "meeting-old",
        meeting_series_key: "series-old",
        meeting_start_at: "2026-02-01T14:00:00.000Z",
        meeting_summary: "Old retrospective",
      }),
    ];

    const options = buildMeetingMinutesMeetingOptions(events, items);

    expect(options.map((option) => option.id)).toContain("meeting-old");
    expect(options.map((option) => option.id)).toContain("meeting-live");
  });

  it("sets completed_at when marking an item as resolved", () => {
    const updated = applyMeetingMinutesStatus(
      baseItem({ status: "in_progress" }),
      "resolved",
      "2026-04-01T15:00:00.000Z",
    );

    expect(updated.status).toBe("resolved");
    expect(updated.completed_at).toBe("2026-04-01T15:00:00.000Z");
  });
});
