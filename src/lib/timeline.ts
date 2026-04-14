import type { TimelineSessionBlock } from "@/types";

const MINUTES_IN_DAY = 24 * 60;

function getDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

export function getDateKeyInTimezone(date: Date, timezone: string): string {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getMillisecondsUntilNextDateChangeInTimezone(date: Date, timezone: string): number {
  const parts = getDateParts(date, timezone);
  const elapsedMs =
    (((parts.hour * 60) + parts.minute) * 60 + parts.second) * 1000
    + date.getMilliseconds();

  return Math.max(1_000, (MINUTES_IN_DAY * 60 * 1000) - elapsedMs + 50);
}

export function getMinutesOfDayInTimezone(date: Date, timezone: string): number {
  const parts = getDateParts(date, timezone);
  return Math.max(0, Math.min(MINUTES_IN_DAY, parts.hour * 60 + parts.minute));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type TimelineSessionInput = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  projectName: string;
  companyName: string | null;
  hourlyRate: number;
  color: string | null;
};

export function buildTimelineBlocks(
  sessions: TimelineSessionInput[],
  timezone: string,
  now: Date,
): TimelineSessionBlock[] {
  const todayKey = getDateKeyInTimezone(now, timezone);

  return sessions
    .map((session) => {
      const startDate = new Date(session.startedAt);
      const endDate = session.endedAt ? new Date(session.endedAt) : now;

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
      }

      if (endDate <= startDate) {
        return null;
      }

      const sessionStartKey = getDateKeyInTimezone(startDate, timezone);
      const sessionEndKey = getDateKeyInTimezone(endDate, timezone);

      if (sessionEndKey < todayKey || sessionStartKey > todayKey) {
        return null;
      }

      let startMinute = 0;
      let endMinute = MINUTES_IN_DAY;

      if (sessionStartKey === todayKey) {
        startMinute = getMinutesOfDayInTimezone(startDate, timezone);
      }

      if (sessionEndKey === todayKey) {
        endMinute = getMinutesOfDayInTimezone(endDate, timezone);
      }

      startMinute = clamp(startMinute, 0, MINUTES_IN_DAY);
      endMinute = clamp(endMinute, 0, MINUTES_IN_DAY);

      if (endMinute <= startMinute) {
        endMinute = Math.min(MINUTES_IN_DAY, startMinute + 1);
      }

      const visibleSeconds = Math.max(0, Math.floor(((endMinute - startMinute) / MINUTES_IN_DAY) * 24 * 60 * 60));
      const estimatedValue = (visibleSeconds / 3600) * session.hourlyRate;

      return {
        id: session.id,
        label: session.projectName,
        company: session.companyName,
        startMinute,
        endMinute,
        leftPercent: (startMinute / MINUTES_IN_DAY) * 100,
        widthPercent: Math.max(((endMinute - startMinute) / MINUTES_IN_DAY) * 100, 0.8),
        durationSeconds: visibleSeconds,
        estimatedValue,
        isActive: session.endedAt === null,
        color: session.color,
      } satisfies TimelineSessionBlock;
    })
    .filter((session): session is TimelineSessionBlock => session !== null)
    .sort((a, b) => a.startMinute - b.startMinute);
}

export function buildTimelineHourLabels(stepHours = 3): number[] {
  const labels: number[] = [];
  for (let hour = 0; hour <= 24; hour += stepHours) {
    labels.push(hour);
  }
  return labels;
}

export function getCurrentMinuteMarker(timezone: string, now: Date): number {
  return getMinutesOfDayInTimezone(now, timezone);
}

export function getSessionOverlapSecondsForDate(
  startedAt: string,
  endedAt: string | null,
  timezone: string,
  dayKey: string,
  now: Date,
): number {
  const startDate = new Date(startedAt);
  const endDate = endedAt ? new Date(endedAt) : now;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  if (endDate <= startDate) {
    return 0;
  }

  const sessionStartKey = getDateKeyInTimezone(startDate, timezone);
  const sessionEndKey = getDateKeyInTimezone(endDate, timezone);

  if (sessionEndKey < dayKey || sessionStartKey > dayKey) {
    return 0;
  }

  let startMinute = 0;
  let endMinute = MINUTES_IN_DAY;

  if (sessionStartKey === dayKey) {
    startMinute = getMinutesOfDayInTimezone(startDate, timezone);
  }

  if (sessionEndKey === dayKey) {
    endMinute = getMinutesOfDayInTimezone(endDate, timezone);
  }

  startMinute = clamp(startMinute, 0, MINUTES_IN_DAY);
  endMinute = clamp(endMinute, 0, MINUTES_IN_DAY);

  if (endMinute <= startMinute) {
    endMinute = Math.min(MINUTES_IN_DAY, startMinute + 1);
  }

  return Math.max(0, Math.floor(((endMinute - startMinute) / MINUTES_IN_DAY) * 24 * 60 * 60));
}


