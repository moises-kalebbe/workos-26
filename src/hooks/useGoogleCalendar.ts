import { useState, useEffect, useCallback, useRef } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/lib/supabase/client";

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

async function getSessionOrThrow() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Sessao nao encontrada");
  }

  return session;
}

export function useGoogleCalendar() {
  const db = supabase as any;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientScope, setInsufficientScope] = useState(false);

  const lastRangeRef = useRef<{ timeMin?: string; timeMax?: string }>({});
  const eventsRef = useRef<CalendarEvent[]>([]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const mergeEventsWithMetadata = useCallback(
    async (apiEvents: ApiEvent[], userId: string): Promise<CalendarEvent[]> => {
      if (apiEvents.length === 0) return [];

      const seriesKeys = [...new Set(apiEvents.map((event) => event.seriesKey))];
      let metadataMap = new Map<string, EventMetadataRow>();

        if (seriesKeys.length > 0) {
          const { data: metadataRows, error: metadataError } = await supabase
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
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setConnected(false);
          setEvents([]);
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({ action: "events" });
        if (timeMin) params.set("timeMin", timeMin);
        if (timeMax) params.set("timeMax", timeMax);

        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/google-calendar?${params}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: SUPABASE_PUBLISHABLE_KEY,
            },
          },
        );

        const result = (await res.json()) as FetchEventsResult;

        if (result.error === "not_connected") {
          setConnected(false);
          setEvents([]);
          setInsufficientScope(false);
          return;
        }

        if (result.error === "insufficient_scope") {
          setConnected(true);
          setEvents([]);
          setInsufficientScope(true);
          setError("Permissao insuficiente do Google Calendar. Reconecte e aceite permissoes de edicao.");
          return;
        }

        if (result.events) {
          setConnected(true);
          setInsufficientScope(false);
          const merged = await mergeEventsWithMetadata(result.events, session.user.id);
          setEvents(merged);
          return;
        }

        if (result.error) {
          setError(result.message || result.error);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [mergeEventsWithMetadata],
  );

  const connectGoogle = useCallback(async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/agenda",
        scopes: GOOGLE_CALENDAR_SCOPES,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });

    if (signInError) {
      setError(signInError.message);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=disconnect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    });

    setConnected(false);
    setEvents([]);
  }, []);

  const respondToInvite = useCallback(
    async (eventId: string, responseStatus: "accepted" | "declined") => {
      const session = await getSessionOrThrow();
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
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/google-calendar?action=rsvp`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: SUPABASE_PUBLISHABLE_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ eventId, responseStatus }),
          },
        );

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
    [],
  );

  const createMeeting = useCallback(
    async (payload: CreateMeetingPayload) => {
      const session = await getSessionOrThrow();

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar?action=create-event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

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
      const session = await getSessionOrThrow();
      const normalizedTags = uniqueTags(tags);

      const { error: saveError } = await db.from("agenda_event_metadata").upsert(
        {
          user_id: session.user.id,
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
    [],
  );

  const loadPreferences = useCallback(async (): Promise<AgendaPreferences> => {
    try {
      const session = await getSessionOrThrow();

      const { data, error: prefError } = await supabase
        .from("agenda_preferences")
        .select("sort_mode, status_filter, priority_filter, tag_filter, show_declined")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (prefError) {
        throw prefError;
      }

      return normalizePreferences(data as unknown as Record<string, unknown> | null);
    } catch {
      return DEFAULT_AGENDA_PREFERENCES;
    }
  }, []);

  const savePreferences = useCallback(async (preferences: AgendaPreferences) => {
    const session = await getSessionOrThrow();

    const { error: prefError } = await db.from("agenda_preferences").upsert(
      {
        user_id: session.user.id,
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
  }, []);

  const storeTokenFromSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;

    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;

    if (providerToken) {
      await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=store-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: providerToken,
          refresh_token: providerRefreshToken,
          expires_at: session.expires_at,
        }),
      });
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    const init = async () => {
      await storeTokenFromSession();
      setLoading(false);
    };

    void init();
  }, [storeTokenFromSession]);

  return {
    events,
    loading,
    connected,
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
  };
}



