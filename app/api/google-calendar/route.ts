import { NextResponse } from "next/server";
import { appendClerkResetHeaders, requireAuth } from "@/lib/auth";
import {
  deleteGoogleToken,
  encodeEventId,
  type EventPayload,
  getValidAccessToken,
  googleJson,
  isInsufficientScope,
  mapGoogleEvent,
  storeGoogleToken,
  type GoogleEvent,
  type ResponseStatus,
} from "@/lib/googleCalendar";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function unauthorizedJsonResponse() {
  const response = jsonResponse({ error: "Unauthorized" }, 401);
  appendClerkResetHeaders(response.headers);
  return response;
}

async function getAccessTokenForUser(userId: string) {
  return getValidAccessToken(userId);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action !== "events") {
      return jsonResponse({ error: "Unknown action" }, 400);
    }

    const tokenResult = await getAccessTokenForUser(user.id);
    if ("error" in tokenResult) {
      return jsonResponse(tokenResult);
    }

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

    const res = await googleJson(tokenResult.accessToken, googleUrl);

    if (!res.ok) {
      if (res.status === 401) {
        await deleteGoogleToken(user.id);
        return jsonResponse({
          error: "not_connected",
          message: "Token expirado, reconecte o Google Calendar",
        });
      }

      if (isInsufficientScope(res.status, res.text, res.data)) {
        return jsonResponse(
          {
            error: "insufficient_scope",
            message: "Google token does not include calendar write permissions",
          },
          403,
        );
      }

      return jsonResponse(
        {
          error: "calendar_error",
          message: res.text || "Google Calendar request failed",
        },
        500,
      );
    }

    const items = (res.data?.items as GoogleEvent[] | undefined) || [];
    return jsonResponse({ events: items.map((event) => mapGoogleEvent(event)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized") {
      return unauthorizedJsonResponse();
    }

    return jsonResponse({ error: message }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "store-token") {
      const body = (await request.json()) as {
        access_token?: string;
        refresh_token?: string | null;
        expires_at?: unknown;
      };

      if (!body.access_token) {
        return jsonResponse(
          { error: "invalid_payload", message: "access_token is required" },
          400,
        );
      }

      await storeGoogleToken(user.id, {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: body.expires_at,
      });
      return jsonResponse({ success: true });
    }

    if (action === "disconnect") {
      await deleteGoogleToken(user.id);
      return jsonResponse({ success: true });
    }

    const tokenResult = await getAccessTokenForUser(user.id);
    if ("error" in tokenResult) {
      return jsonResponse(tokenResult);
    }

    if (action === "rsvp") {
      const { eventId, responseStatus } = (await request.json()) as {
        eventId?: string;
        responseStatus?: ResponseStatus;
      };

      if (!eventId || (responseStatus !== "accepted" && responseStatus !== "declined")) {
        return jsonResponse(
          {
            error: "invalid_payload",
            message: "eventId and valid responseStatus are required",
          },
          400,
        );
      }

      const eventRes = await googleJson(
        tokenResult.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeEventId(eventId)}`,
      );

      if (!eventRes.ok) {
        if (isInsufficientScope(eventRes.status, eventRes.text, eventRes.data)) {
          return jsonResponse(
            {
              error: "insufficient_scope",
              message: "Google token does not include calendar write permissions",
            },
            403,
          );
        }

        return jsonResponse(
          {
            error: "calendar_error",
            message: eventRes.text || "Unable to fetch event",
          },
          500,
        );
      }

      const eventData = eventRes.data as unknown as GoogleEvent;
      const attendees = eventData.attendees || [];
      const selfIndex = attendees.findIndex((attendee) => attendee.self);

      if (selfIndex < 0) {
        return jsonResponse(
          {
            error: "cannot_respond",
            message: "No self attendee found for RSVP",
          },
          400,
        );
      }

      attendees[selfIndex] = { ...attendees[selfIndex], responseStatus };

      const patchRes = await googleJson(
        tokenResult.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeEventId(eventId)}?sendUpdates=all`,
        {
          method: "PATCH",
          body: JSON.stringify({ attendees }),
        },
      );

      if (!patchRes.ok) {
        if (isInsufficientScope(patchRes.status, patchRes.text, patchRes.data)) {
          return jsonResponse(
            {
              error: "insufficient_scope",
              message: "Google token does not include calendar write permissions",
            },
            403,
          );
        }

        return jsonResponse(
          {
            error: "calendar_error",
            message: patchRes.text || "Unable to update RSVP",
          },
          500,
        );
      }

      return jsonResponse({
        event: mapGoogleEvent(patchRes.data as unknown as GoogleEvent),
      });
    }

    if (action === "create-event") {
      const body = (await request.json()) as EventPayload;

      if (!body.summary || !body.start || !body.end || !body.timeZone) {
        return jsonResponse(
          {
            error: "invalid_payload",
            message: "summary, start, end and timeZone are required",
          },
          400,
        );
      }

      const attendees = (body.attendees || [])
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => ({ email }));

      const eventBody: Record<string, unknown> = {
        summary: body.summary,
        description: body.description || undefined,
        location: body.location || undefined,
        start: { dateTime: body.start, timeZone: body.timeZone },
        end: { dateTime: body.end, timeZone: body.timeZone },
        attendees,
      };

      let queryParams = "sendUpdates=all";

      if (body.createMeet) {
        eventBody.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
        queryParams += "&conferenceDataVersion=1";
      }

      const createRes = await googleJson(
        tokenResult.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${queryParams}`,
        {
          method: "POST",
          body: JSON.stringify(eventBody),
        },
      );

      if (!createRes.ok) {
        if (isInsufficientScope(createRes.status, createRes.text, createRes.data)) {
          return jsonResponse(
            {
              error: "insufficient_scope",
              message: "Google token does not include calendar write permissions",
            },
            403,
          );
        }

        return jsonResponse(
          {
            error: "calendar_error",
            message: createRes.text || "Unable to create event",
          },
          500,
        );
      }

      return jsonResponse({
        event: mapGoogleEvent(createRes.data as unknown as GoogleEvent),
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "Unauthorized") {
      return unauthorizedJsonResponse();
    }

    return jsonResponse({ error: message }, 500);
  }
}


