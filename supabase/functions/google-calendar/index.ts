import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type GoogleAttendee = {
  email?: string;
  responseStatus?: string;
  self?: boolean;
};

type GoogleEvent = {
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

type ResponseStatus = "accepted" | "declined";

type EventPayload = {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  timeZone: string;
  attendees?: string[];
  createMeet?: boolean;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapGoogleEvent(event: GoogleEvent) {
  const selfAttendee = event.attendees?.find((attendee) => attendee.self);
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || start;
  const selfResponseStatus = (selfAttendee?.responseStatus ?? "none") as
    | "needsAction"
    | "accepted"
    | "declined"
    | "tentative"
    | "none";

  const meetEntryPoint = event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === "video")?.uri;

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

function encodeEventId(eventId: string) {
  return encodeURIComponent(eventId);
}

async function googleJson(
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

function isInsufficientScope(status: number, text: string, data: Record<string, unknown> | null) {
  if (status !== 403) return false;

  const errorText = text.toLowerCase();
  if (errorText.includes("insufficientpermissions") || errorText.includes("insufficient permissions")) {
    return true;
  }

  const message = String(data?.error ?? "").toLowerCase();
  return message.includes("insufficient");
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: tokenRow, error: tokenError } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return { error: "not_connected", message: "Google Calendar not connected" as const };
  }

  let accessToken = tokenRow.access_token;

  if (
    tokenRow.expires_at &&
    new Date(tokenRow.expires_at) < new Date() &&
    tokenRow.refresh_token
  ) {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenRow.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;

        await supabase
          .from("google_tokens")
          .update({
            access_token: refreshData.access_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
    }
  }

  return { accessToken };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.claims.sub as string;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "store-token") {
      const { access_token, refresh_token, expires_at } = await req.json();

      const { error } = await supabase.from("google_tokens").upsert(
        {
          user_id: userId,
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expires_at ? new Date(expires_at * 1000).toISOString() : null,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        console.error("Error storing token:", error);
        return jsonResponse({ error: "Failed to store token" }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (action === "disconnect") {
      await supabase.from("google_tokens").delete().eq("user_id", userId);
      return jsonResponse({ success: true });
    }

    const tokenResult = await getValidAccessToken(supabase, userId);
    if ("error" in tokenResult) {
      return jsonResponse(tokenResult, 200);
    }
    const accessToken = tokenResult.accessToken;

    if (action === "events") {
      const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
      const timeMax =
        url.searchParams.get("timeMax") ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const googleUrl =
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
        new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
          showHiddenInvitations: "true",
        });

      const res = await googleJson(accessToken, googleUrl);

      if (!res.ok) {
        console.error("Google Calendar API error:", res.status, res.text);

        if (res.status === 401) {
          await supabase.from("google_tokens").delete().eq("user_id", userId);
          return jsonResponse({ error: "not_connected", message: "Token expired, please reconnect" }, 200);
        }

        if (isInsufficientScope(res.status, res.text, res.data)) {
          return jsonResponse({
            error: "insufficient_scope",
            message: "Google token does not include calendar write permissions",
          }, 403);
        }

        return jsonResponse({ error: "calendar_error", message: res.text || "Google Calendar request failed" }, 500);
      }

      const items = (res.data?.items as GoogleEvent[] | undefined) || [];
      const events = items.map((event) => mapGoogleEvent(event));

      return jsonResponse({ events });
    }

    if (action === "rsvp") {
      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const { eventId, responseStatus } = (await req.json()) as {
        eventId?: string;
        responseStatus?: ResponseStatus;
      };

      if (!eventId || (responseStatus !== "accepted" && responseStatus !== "declined")) {
        return jsonResponse({ error: "invalid_payload", message: "eventId and valid responseStatus are required" }, 400);
      }

      const eventRes = await googleJson(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeEventId(eventId)}`,
      );

      if (!eventRes.ok) {
        if (isInsufficientScope(eventRes.status, eventRes.text, eventRes.data)) {
          return jsonResponse({
            error: "insufficient_scope",
            message: "Google token does not include calendar write permissions",
          }, 403);
        }

        return jsonResponse({ error: "calendar_error", message: eventRes.text || "Unable to fetch event" }, 500);
      }

      const eventData = eventRes.data as unknown as GoogleEvent;
      const attendees = eventData.attendees || [];
      const selfIndex = attendees.findIndex((attendee) => attendee.self);

      if (selfIndex < 0) {
        return jsonResponse({ error: "cannot_respond", message: "No self attendee found for RSVP" }, 400);
      }

      attendees[selfIndex] = {
        ...attendees[selfIndex],
        responseStatus,
      };

      const patchRes = await googleJson(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeEventId(eventId)}?sendUpdates=all`,
        {
          method: "PATCH",
          body: JSON.stringify({ attendees }),
        },
      );

      if (!patchRes.ok) {
        if (isInsufficientScope(patchRes.status, patchRes.text, patchRes.data)) {
          return jsonResponse({
            error: "insufficient_scope",
            message: "Google token does not include calendar write permissions",
          }, 403);
        }

        return jsonResponse({ error: "calendar_error", message: patchRes.text || "Unable to update RSVP" }, 500);
      }

      const updatedEvent = mapGoogleEvent(patchRes.data as unknown as GoogleEvent);
      return jsonResponse({ event: updatedEvent });
    }

    if (action === "create-event") {
      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const body = (await req.json()) as EventPayload;

      if (!body.summary || !body.start || !body.end || !body.timeZone) {
        return jsonResponse({
          error: "invalid_payload",
          message: "summary, start, end and timeZone are required",
        }, 400);
      }

      const attendees = (body.attendees || [])
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => ({ email }));

      const eventBody: Record<string, unknown> = {
        summary: body.summary,
        description: body.description || undefined,
        location: body.location || undefined,
        start: {
          dateTime: body.start,
          timeZone: body.timeZone,
        },
        end: {
          dateTime: body.end,
          timeZone: body.timeZone,
        },
        attendees,
      };

      let queryParams = "sendUpdates=all";

      if (body.createMeet) {
        eventBody.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        };
        queryParams += "&conferenceDataVersion=1";
      }

      const createRes = await googleJson(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${queryParams}`,
        {
          method: "POST",
          body: JSON.stringify(eventBody),
        },
      );

      if (!createRes.ok) {
        if (isInsufficientScope(createRes.status, createRes.text, createRes.data)) {
          return jsonResponse({
            error: "insufficient_scope",
            message: "Google token does not include calendar write permissions",
          }, 403);
        }

        return jsonResponse({ error: "calendar_error", message: createRes.text || "Unable to create event" }, 500);
      }

      const createdEvent = mapGoogleEvent(createRes.data as unknown as GoogleEvent);
      return jsonResponse({ event: createdEvent });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
