import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface TimerState {
  activeSessionId: string | null;
  activeProjectId: string | null;
  startedAt: Date | null;
  elapsed: number;
}

type TimerSessionRow = {
  id: string;
  project_id: string;
  started_at: string;
};

export type TimerStartOptions = {
  origin?: "manual" | "quick_start";
  requestId?: string;
  taskId?: string;
};

export function useTimer() {
  const [state, setState] = useState<TimerState>({
    activeSessionId: null,
    activeProjectId: null,
    startedAt: null,
    elapsed: 0,
  });
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const startInFlightRef = useRef<Promise<TimerSessionRow | null> | null>(null);

  useEffect(() => {
    async function checkActive() {
      const { data } = await supabase
        .from("time_sessions")
        .select("id, project_id, started_at")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const started = new Date(data.started_at);
        setState({
          activeSessionId: data.id,
          activeProjectId: data.project_id,
          startedAt: started,
          elapsed: Math.floor((Date.now() - started.getTime()) / 1000),
        });
      }
    }
    checkActive();
  }, []);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    if (state.startedAt) {
      tickRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsed: Math.floor((Date.now() - prev.startedAt!.getTime()) / 1000),
        }));
      }, 1000);
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.startedAt]);

  const start = useCallback(async (projectId: string, userId: string, _options?: TimerStartOptions) => {
    if (startInFlightRef.current) {
      return await startInFlightRef.current;
    }

    const startPromise = (async (): Promise<TimerSessionRow | null> => {
      const nowIso = new Date().toISOString();
      const { data: activeSession } = await supabase
        .from("time_sessions")
        .select("id, project_id, started_at")
        .eq("user_id", userId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const normalizedActiveSession = (activeSession || null) as TimerSessionRow | null;

      if (normalizedActiveSession?.project_id === projectId) {
        const startedAt = new Date(normalizedActiveSession.started_at);
        setState({
          activeSessionId: normalizedActiveSession.id,
          activeProjectId: normalizedActiveSession.project_id,
          startedAt,
          elapsed: Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)),
        });
        return normalizedActiveSession;
      }

      if (normalizedActiveSession) {
        await supabase
          .from("time_sessions")
          .update({ ended_at: nowIso })
          .eq("id", normalizedActiveSession.id);
      }

      const { data } = await supabase
        .from("time_sessions")
        .insert({
          project_id: projectId,
          user_id: userId,
          started_at: nowIso,
        })
        .select("id, project_id, started_at")
        .single();

      const normalizedData = (data || null) as TimerSessionRow | null;
      if (!normalizedData) return null;

      const startedAt = new Date(normalizedData.started_at);
      setState({
        activeSessionId: normalizedData.id,
        activeProjectId: normalizedData.project_id,
        startedAt,
        elapsed: 0,
      });

      return normalizedData;
    })();

    startInFlightRef.current = startPromise;

    try {
      return await startPromise;
    } finally {
      if (startInFlightRef.current === startPromise) {
        startInFlightRef.current = null;
      }
    }
  }, []);

  const stop = useCallback(async () => {
    if (!state.activeSessionId) return null;

    const { data } = await supabase
      .from("time_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", state.activeSessionId)
      .select()
      .single();

    setState({
      activeSessionId: null,
      activeProjectId: null,
      startedAt: null,
      elapsed: 0,
    });

    return data;
  }, [state.activeSessionId]);

  return {
    ...state,
    isRunning: !!state.activeSessionId,
    start,
    stop,
  };
}


