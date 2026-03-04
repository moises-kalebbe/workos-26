import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { Tables } from "@/integrations/supabase/types";

type MeetingTopicRow = Tables<"agenda_meeting_topics">;

export type MeetingTopicStatus = "pending" | "in_progress" | "resolved";

export type MeetingTopic = Omit<MeetingTopicRow, "status"> & {
  status: MeetingTopicStatus;
};

export type CreateMeetingTopicInput = {
  title: string;
  detail?: string;
  conclusion?: string;
  status?: MeetingTopicStatus;
};

export type UpdateMeetingTopicInput = {
  title?: string;
  detail?: string;
  conclusion?: string;
  status?: MeetingTopicStatus;
};

type MeetingSnapshot = Pick<CalendarEvent, "id" | "seriesKey" | "start" | "summary">;

function normalizeStatus(value: string | null | undefined): MeetingTopicStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return "pending";
}

function normalizeTopic(row: MeetingTopicRow): MeetingTopic {
  return {
    ...row,
    status: normalizeStatus(row.status),
  };
}

function sortTopicsByCreatedAt(topics: MeetingTopic[]) {
  return [...topics].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
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

export function useAgendaTopics() {
  const loadedMeetingsRef = useRef<Set<string>>(new Set());
  const [topicsByMeetingId, setTopicsByMeetingId] = useState<Record<string, MeetingTopic[]>>({});
  const [loadingByMeetingId, setLoadingByMeetingId] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const inFlightByMeetingIdRef = useRef<Record<string, Promise<MeetingTopic[]>>>({});
  const topicsByMeetingIdRef = useRef<Record<string, MeetingTopic[]>>({});

  useEffect(() => {
    topicsByMeetingIdRef.current = topicsByMeetingId;
  }, [topicsByMeetingId]);

  const getTopics = useCallback((meetingEventId: string) => {
    return topicsByMeetingId[meetingEventId] || [];
  }, [topicsByMeetingId]);

  const isMeetingLoading = useCallback((meetingEventId: string) => {
    return loadingByMeetingId[meetingEventId] === true;
  }, [loadingByMeetingId]);

  const setMeetingLoadingState = useCallback((meetingId: string, isLoading: boolean) => {
    setLoadingByMeetingId((prev) => {
      const previousValue = prev[meetingId] === true;
      if (previousValue === isLoading) {
        return prev;
      }
      return { ...prev, [meetingId]: isLoading };
    });
  }, []);

  const loadTopics = useCallback(async (meeting: MeetingSnapshot | null, force = false) => {
    if (!meeting) return [];
    if (!force && loadedMeetingsRef.current.has(meeting.id)) {
      return topicsByMeetingIdRef.current[meeting.id] || [];
    }

    const inFlightRequest = inFlightByMeetingIdRef.current[meeting.id];
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = (async () => {
      setMeetingLoadingState(meeting.id, true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from("agenda_meeting_topics")
          .select("*")
          .eq("meeting_event_id", meeting.id)
          .order("created_at", { ascending: true });

        if (queryError) {
          throw queryError;
        }

        const normalized = ((data || []) as MeetingTopicRow[]).map(normalizeTopic);
        loadedMeetingsRef.current.add(meeting.id);

        setTopicsByMeetingId((prev) => ({
          ...prev,
          [meeting.id]: normalized,
        }));

        return normalized;
      } catch (loadError) {
        const message = (loadError as Error).message || "Falha ao carregar topicos";
        setError(message);
        throw loadError;
      } finally {
        delete inFlightByMeetingIdRef.current[meeting.id];
        setMeetingLoadingState(meeting.id, false);
      }
    })();

    inFlightByMeetingIdRef.current[meeting.id] = request;
    return request;
  }, [setMeetingLoadingState]);

  const createTopic = useCallback(async (meeting: MeetingSnapshot, input: CreateMeetingTopicInput) => {
    setError(null);
    const session = await getSessionOrThrow();

    const { data, error: insertError } = await supabase
      .from("agenda_meeting_topics")
      .insert({
        user_id: session.user.id,
        meeting_event_id: meeting.id,
        meeting_series_key: meeting.seriesKey,
        meeting_start_at: meeting.start,
        meeting_summary: meeting.summary,
        title: input.title.trim(),
        detail: input.detail?.trim() || "",
        conclusion: input.conclusion?.trim() || "",
        status: input.status || "pending",
      })
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      throw insertError;
    }

    const created = normalizeTopic(data as MeetingTopicRow);
    loadedMeetingsRef.current.add(meeting.id);

    setTopicsByMeetingId((prev) => {
      const nextTopics = sortTopicsByCreatedAt([...(prev[meeting.id] || []), created]);
      return {
        ...prev,
        [meeting.id]: nextTopics,
      };
    });

    return created;
  }, []);

  const updateTopic = useCallback(async (topicId: string, patch: UpdateMeetingTopicInput) => {
    setError(null);

    const payload: Record<string, unknown> = {};

    if (patch.title !== undefined) payload.title = patch.title.trim();
    if (patch.detail !== undefined) payload.detail = patch.detail.trim();
    if (patch.conclusion !== undefined) payload.conclusion = patch.conclusion.trim();
    if (patch.status !== undefined) payload.status = patch.status;

    if (Object.keys(payload).length === 0) {
      return null;
    }

    const { data, error: updateError } = await supabase
      .from("agenda_meeting_topics")
      .update(payload)
      .eq("id", topicId)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      throw updateError;
    }

    const updated = normalizeTopic(data as MeetingTopicRow);

    setTopicsByMeetingId((prev) => {
      const next: Record<string, MeetingTopic[]> = {};

      for (const [meetingId, topics] of Object.entries(prev)) {
        next[meetingId] = topics.filter((topic) => topic.id !== updated.id);
      }

      const targetTopics = next[updated.meeting_event_id] || [];
      next[updated.meeting_event_id] = sortTopicsByCreatedAt([...targetTopics, updated]);

      return next;
    });

    return updated;
  }, []);

  const deleteTopic = useCallback(async (topicId: string) => {
    setError(null);

    const { error: deleteError } = await supabase
      .from("agenda_meeting_topics")
      .delete()
      .eq("id", topicId);

    if (deleteError) {
      setError(deleteError.message);
      throw deleteError;
    }

    setTopicsByMeetingId((prev) => {
      const next: Record<string, MeetingTopic[]> = {};

      for (const [meetingId, topics] of Object.entries(prev)) {
        next[meetingId] = topics.filter((topic) => topic.id !== topicId);
      }

      return next;
    });
  }, []);

  const copyTopicToMeeting = useCallback(
    async (topic: MeetingTopic, targetMeeting: MeetingSnapshot) => {
      setError(null);
      const session = await getSessionOrThrow();

      const { data, error: copyError } = await supabase
        .from("agenda_meeting_topics")
        .insert({
          user_id: session.user.id,
          meeting_event_id: targetMeeting.id,
          meeting_series_key: targetMeeting.seriesKey,
          meeting_start_at: targetMeeting.start,
          meeting_summary: targetMeeting.summary,
          title: topic.title,
          detail: topic.detail,
          conclusion: topic.conclusion,
          status: topic.status,
          carried_from_topic_id: topic.id,
        })
        .select("*")
        .single();

      if (copyError) {
        setError(copyError.message);
        throw copyError;
      }

      const copied = normalizeTopic(data as MeetingTopicRow);
      loadedMeetingsRef.current.add(targetMeeting.id);

      setTopicsByMeetingId((prev) => {
        const nextTopics = sortTopicsByCreatedAt([...(prev[targetMeeting.id] || []), copied]);
        return {
          ...prev,
          [targetMeeting.id]: nextTopics,
        };
      });

      return copied;
    },
    [],
  );

  return useMemo(
    () => ({
      error,
      getTopics,
      isMeetingLoading,
      loadTopics,
      createTopic,
      updateTopic,
      deleteTopic,
      copyTopicToMeeting,
    }),
    [
      error,
      getTopics,
      isMeetingLoading,
      loadTopics,
      createTopic,
      updateTopic,
      deleteTopic,
      copyTopicToMeeting,
    ],
  );
}
