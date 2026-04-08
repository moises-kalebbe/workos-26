import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";

export type AgendaPriority = "urgent" | "high" | "normal" | "low";
export type AgendaSortMode = "priority_then_time" | "time_only";
export type AgendaStatusFilter = "all" | "pending" | "accepted" | "declined";
export type CalendarResponseStatus =
  | "needsAction"
  | "accepted"
  | "declined"
  | "tentative"
  | "none";

export interface CalendarEvent {
  id: string;
  seriesKey: string;
  recurringEventId: string | null;
  iCalUID: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
  meetLink: string | null;
  status: string;
  colorId: string | null;
  priority: AgendaPriority;
  tags: string[];
  projectId: string | null;
  projectName: string | null;
  selfResponseStatus: CalendarResponseStatus;
  canRespond: boolean;
  isOrganizer: boolean;
}

export interface AgendaPreferences {
  sortMode: AgendaSortMode;
  statusFilter: AgendaStatusFilter;
  priorityFilter: AgendaPriority[];
  tagFilter: string[];
  showDeclined: boolean;
}

export interface CreateMeetingPayload {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  timeZone: string;
  attendees: string[];
  createMeet: boolean;
}

const DEFAULT_PRIORITY: AgendaPriority = "normal";
const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

export const DEFAULT_AGENDA_PREFERENCES: AgendaPreferences = {
  sortMode: "priority_then_time",
  statusFilter: "all",
  priorityFilter: [],
  tagFilter: [],
  showDeclined: true,
};

type ApiEvent = Omit<CalendarEvent, "priority" | "tags" | "projectId" | "projectName">;

type FetchEventsResult = {
  events?: ApiEvent[];
  error?: string;
  message?: string;
};

type EventMetadataRow = {
  series_key: string;
  priority: string;
  tags: string[];
  project_id: string | null;
  project: { name: string } | { name: string }[] | null;
};

function normalizePriority(priority: string | null | undefined): AgendaPriority {
  if (priority === "urgent" || priority === "high" || priority === "normal" || priority === "low") {
    return priority;
  }
  return DEFAULT_PRIORITY;
}

function normalizePreferences(raw: Record<string, unknown> | null): AgendaPreferences {
  if (!raw) return DEFAULT_AGENDA_PREFERENCES;

  const priorityFilter = Array.isArray(raw.priority_filter)
    ? raw.priority_filter.map((item) => normalizePriority(String(item)))
    : [];

  const tagFilter = Array.isArray(raw.tag_filter)
    ? raw.tag_filter
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0)
    : [];

  const sortMode = raw.sort_mode === "time_only" ? "time_only" : "priority_then_time";
  const statusFilter =
    raw.status_filter === "pending" ||
    raw.status_filter === "accepted" ||
    raw.status_filter === "declined"
      ? raw.status_filter
      : "all";

  return {
    sortMode,
    statusFilter,
    priorityFilter,
    tagFilter,
    showDeclined: raw.show_declined !== false,
  };
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
}

function getProjectNameFromMetadata(value: EventMetadataRow["project"]): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name || null;
  return value.name || null;
}

async function getClerkTokenOrThrow(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (!token) {
    throw new Error("Sessão Clerk não encontrada");
  }
  return token;
}

export function useGoogleCalendar() {
  const { user, getToken } = useAuth();
  const dbClient = db as any;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientScope, setInsufficientScope] = useState(false);

  const lastRangeRef = useRef<{ timeMin?: string; timeMax?: string }>({});
  const eventsRef = useRef<CalendarEvent[]>([]);

  const getClerkUserId = useCallback(() => {
    return user?.id || null;
  }, [user]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const mergeEventsWithMetadata = useCallback(
    async (apiEvents: ApiEvent[], userId: string): Promise<CalendarEvent[]> => {
      if (apiEvents.length === 0) return [];

      const seriesKeys = [...new Set(apiEvents.map((event) => event.seriesKey))];
      let metadataMap = new Map<string, EventMetadataRow>();

        if (seriesKeys.length > 0) {
          const { data: metadataRows, error: metadataError } = await dbClient
            .from("agenda_event_metadata")
            .select("series_key, priority, tags, project_id, project:projects(name)")
            .eq("user_id", userId)
            .in("series_key", seriesKeys);

        if (metadataError) {
          throw metadataError;
        }

        metadataMap = new Map(
          ((metadataRows || []) as EventMetadataRow[]).map((row) => [row.series_key, row]),
        );
      }

        return apiEvents.map((event) => {
          const metadata = metadataMap.get(event.seriesKey);

          return {
            ...event,
            priority: normalizePriority(metadata?.priority),
            tags: uniqueTags(metadata?.tags || []),
            projectId: metadata?.project_id || null,
            projectName: metadata ? getProjectNameFromMetadata(metadata.project) : null,
          };
        });
      },
    [],
  );

  const fetchEvents = useCallback(
    async (timeMin?: string, timeMax?: string) => {
      setLoading(true);
      setError(null);

      if (timeMin || timeMax) {
        lastRangeRef.current = { timeMin, timeMax };
      }

      try {
        const token = await getClerkTokenOrThrow(getToken);

        const params = new URLSearchParams({ action: "events" });
        if (timeMin) params.set("timeMin", timeMin);
        if (timeMax) params.set("timeMax", timeMax);

        const res = await fetch(`/api/google-calendar?${params}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = (await res.json()) as FetchEventsResult;

        if (result.error === "not_connected") {
          setConnected(false);
          setConnectionReady(true);
          setEvents([]);
          setInsufficientScope(false);
          return;
        }

        if (result.error === "insufficient_scope") {
          setConnected(true);
          setConnectionReady(true);
          setEvents([]);
          setInsufficientScope(true);
          setError("Permissão insuficiente do Google Calendar. Reconecte e aceite permissões de edição.");
          return;
        }

        if (result.events) {
          setConnected(true);
          setConnectionReady(true);
          setInsufficientScope(false);
          const userId = getClerkUserId();
          if (userId) {
            const merged = await mergeEventsWithMetadata(result.events, userId);
            setEvents(merged);
          }
          return;
        }

        if (result.error) {
          setConnected(false);
          setConnectionReady(true);
          setError(result.message || result.error);
        }
      } catch (err) {
        setConnected(false);
        setConnectionReady(true);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [getToken, mergeEventsWithMetadata],
  );

  const connectGoogle = useCallback(async () => {
    return;
  }, []);

  const disconnect = useCallback(async () => {
    const token = await getToken().catch(() => null);
    if (!token) return;

    await fetch(`/api/google-calendar?action=disconnect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    setConnected(false);
    setConnectionReady(true);
    setEvents([]);
  }, [getToken]);

  const respondToInvite = useCallback(
    async (eventId: string, responseStatus: "accepted" | "declined") => {
      const token = await getClerkTokenOrThrow(getToken);
      const previousEvents = eventsRef.current;

      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? {
                ...event,
                selfResponseStatus: responseStatus,
              }
            : event,
        ),
      );

      try {
        const res = await fetch(`/api/google-calendar?action=rsvp`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ eventId, responseStatus }),
        });

        const result = (await res.json()) as {
          error?: string;
          message?: string;
          event?: ApiEvent;
        };

        if (result.error) {
          if (result.error === "insufficient_scope") {
            setInsufficientScope(true);
          }
          setEvents(previousEvents);
          throw new Error(result.message || result.error);
        }

        if (result.event) {
          setEvents((prev) =>
            prev.map((event) =>
              event.id === eventId
                ? {
                    ...event,
                    ...result.event,
                    priority: event.priority,
                    tags: event.tags,
                  }
                : event,
            ),
          );
        }
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [getToken],
  );

  const createMeeting = useCallback(
    async (payload: CreateMeetingPayload) => {
      const token = await getClerkTokenOrThrow(getToken);

      const res = await fetch(`/api/google-calendar?action=create-event`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await res.json()) as {
        error?: string;
        message?: string;
        event?: ApiEvent;
      };

      if (result.error) {
        if (result.error === "insufficient_scope") {
          setInsufficientScope(true);
        }
        throw new Error(result.message || result.error);
      }

      const { timeMin, timeMax } = lastRangeRef.current;
      await fetchEvents(timeMin, timeMax);

      return result.event;
    },
    [fetchEvents],
  );

  const saveEventMetadata = useCallback(
    async (
      seriesKey: string,
      priority: AgendaPriority,
      tags: string[],
      projectId: string | null,
      projectName: string | null = null,
    ) => {
      const userId = getClerkUserId();
      if (!userId) throw new Error("Usuário não autenticado");
      const normalizedTags = uniqueTags(tags);

      const { error: saveError } = await dbClient.from("agenda_event_metadata").upsert(
        {
          user_id: userId,
          series_key: seriesKey,
          priority,
          tags: normalizedTags,
          project_id: projectId,
        },
        { onConflict: "user_id,series_key" },
      );

      if (saveError) {
        setError(saveError.message);
        throw saveError;
      }

      setEvents((prev) =>
        prev.map((event) =>
          event.seriesKey === seriesKey
            ? {
                ...event,
                priority,
                tags: normalizedTags,
                projectId,
                projectName,
              }
            : event,
        ),
      );
    },
    [dbClient, getClerkUserId],
  );

  const loadPreferences = useCallback(async (): Promise<AgendaPreferences> => {
    try {
      const userId = getClerkUserId();
      if (!userId) throw new Error("Usuário não autenticado");

      const { data, error: prefError } = await dbClient
        .from("agenda_preferences")
        .select("sort_mode, status_filter, priority_filter, tag_filter, show_declined")
        .eq("user_id", userId)
        .maybeSingle();

      if (prefError) {
        throw prefError;
      }

      return normalizePreferences(data as unknown as Record<string, unknown> | null);
    } catch {
      return DEFAULT_AGENDA_PREFERENCES;
    }
  }, [getClerkUserId]);

  const savePreferences = useCallback(async (preferences: AgendaPreferences) => {
    const userId = getClerkUserId();
    if (!userId) throw new Error("Usuário não autenticado");

    const { error: prefError } = await dbClient.from("agenda_preferences").upsert(
      {
        user_id: userId,
        sort_mode: preferences.sortMode,
        status_filter: preferences.statusFilter,
        priority_filter: preferences.priorityFilter,
        tag_filter: uniqueTags(preferences.tagFilter),
        show_declined: preferences.showDeclined,
      },
      { onConflict: "user_id" },
    );

    if (prefError) {
      setError(prefError.message);
      throw prefError;
    }
  }, [dbClient, getClerkUserId]);

  const storeGoogleToken = useCallback(
    async (accessToken: string, refreshToken?: string | null, expiresAt?: number) => {
      const token = await getClerkTokenOrThrow(getToken);

      await fetch(`/api/google-calendar?action=store-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken || null,
          expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
        }),
      });
    },
    [getToken],
  );

  useEffect(() => {
    if (!user) {
      setConnected(false);
      setConnectionReady(true);
      setEvents([]);
      setLoading(false);
    }
  }, [user]);

  return {
    events,
    loading,
    connected,
    connectionReady,
    error,
    insufficientScope,
    connectGoogle,
    disconnect,
    fetchEvents,
    respondToInvite,
    createMeeting,
    saveEventMetadata,
    loadPreferences,
    savePreferences,
    storeGoogleToken,
  };
}



