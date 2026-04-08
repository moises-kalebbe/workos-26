import { sql } from "@/lib/db";

export type GoogleAttendee = {
  email?: string;
  responseStatus?: string;
  self?: boolean;
};

export type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
  colorId?: string;
  recurringEventId?: string;
  iCalUID?: string;
  conferenceData?: {
    entryPoints?: Array<{
      uri?: string;
      entryPointType?: string;
    }>;
  };
  attendees?: GoogleAttendee[];
  organizer?: {
    self?: boolean;
  };
};

type GoogleTokenRow = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

export type CalendarResponseStatus =
  | "needsAction"
  | "accepted"
  | "declined"
  | "tentative"
  | "none";

export type ResponseStatus = "accepted" | "declined";

export type EventPayload = {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  timeZone: string;
  attendees?: string[];
  createMeet?: boolean;
};

export function mapGoogleEvent(event: GoogleEvent) {
  const selfAttendee = event.attendees?.find((attendee) => attendee.self);
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || start;
  const selfResponseStatus = (selfAttendee?.responseStatus ?? "none") as CalendarResponseStatus;
  const meetEntryPoint = event.conferenceData?.entryPoints?.find(
    (entryPoint) => entryPoint.entryPointType === "video",
  )?.uri;

  return {
    id: event.id,
    seriesKey: event.recurringEventId || event.id,
    recurringEventId: event.recurringEventId || null,
    iCalUID: event.iCalUID || null,
    summary: event.summary || "(Sem titulo)",
    description: event.description || null,
    location: event.location || null,
    start,
    end,
    allDay: !event.start?.dateTime,
    htmlLink: event.htmlLink || "",
    meetLink: event.hangoutLink || meetEntryPoint || null,
    status: event.status || "confirmed",
    colorId: event.colorId || null,
    selfResponseStatus,
    canRespond: selfAttendee !== undefined && event.organizer?.self !== true,
    isOrganizer: event.organizer?.self === true,
  };
}

export function encodeEventId(eventId: string) {
  return encodeURIComponent(eventId);
}

export async function googleJson(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; text: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: Record<string, unknown> | null = null;

  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  return { ok: res.ok, status: res.status, data, text };
}

export function isInsufficientScope(
  status: number,
  text: string,
  data: Record<string, unknown> | null,
) {
  if (status !== 403) return false;

  const errorText = text.toLowerCase();
  if (
    errorText.includes("insufficientpermissions") ||
    errorText.includes("insufficient permissions")
  ) {
    return true;
  }

  const message = String(data?.error ?? "").toLowerCase();
  return message.includes("insufficient");
}

export function parseExpiresAt(value: unknown) {
  if (value == null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      return new Date(Number(trimmed) * 1000).toISOString();
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  throw new Error("expires_at invalido");
}

export async function storeGoogleToken(
  userId: string,
  payload: {
    access_token: string;
    refresh_token?: string | null;
    expires_at?: unknown;
  },
) {
  const expiresAt = parseExpiresAt(payload.expires_at);

  const rows = await sql<GoogleTokenRow[]>`
    INSERT INTO google_tokens (user_id, access_token, refresh_token, expires_at)
    VALUES (${userId}, ${payload.access_token}, ${payload.refresh_token || null}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
      expires_at = EXCLUDED.expires_at
    RETURNING user_id, access_token, refresh_token, expires_at
  `;

  return rows[0] ?? null;
}

export async function deleteGoogleToken(userId: string) {
  await sql`DELETE FROM google_tokens WHERE user_id = ${userId}`;
}

async function refreshAccessToken(tokenRow: GoogleTokenRow) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!tokenRow.refresh_token || !googleClientId || !googleClientSecret) {
    return null;
  }

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) {
    return null;
  }

  const refreshData = (await refreshRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await sql`
    UPDATE google_tokens
    SET access_token = ${refreshData.access_token},
        expires_at = ${expiresAt}
    WHERE user_id = ${tokenRow.user_id}
  `;

  return refreshData.access_token;
}

export async function getValidAccessToken(userId: string) {
  const rows = await sql<(GoogleTokenRow & { user_id: string })[]>`
    SELECT user_id, access_token, refresh_token, expires_at
    FROM google_tokens
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  const tokenRow = rows[0];

  if (!tokenRow) {
    return { error: "not_connected", message: "Google Calendar not connected" as const };
  }

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    const refreshedToken = await refreshAccessToken(tokenRow);
    if (refreshedToken) {
      return { accessToken: refreshedToken };
    }
  }

  return { accessToken: tokenRow.access_token };
}



