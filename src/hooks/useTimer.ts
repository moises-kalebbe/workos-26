import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/dbClient";

interface TimerState {
  activeSessionId: string | null;
  activeProjectId: string | null;
  startedAt: Date | null;
  elapsed: number;
}

export function useTimer() {
  const [state, setState] = useState<TimerState>({
    activeSessionId: null,
    activeProjectId: null,
    startedAt: null,
    elapsed: 0,
  });
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    async function checkActive() {
      const { data } = await db
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

  const start = useCallback(async (projectId: string, userId: string) => {
    if (state.activeSessionId) {
      await db
        .from("time_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", state.activeSessionId);
    }

    const now = new Date();
    const { data } = await db
      .from("time_sessions")
      .insert({
        project_id: projectId,
        user_id: userId,
        started_at: now.toISOString(),
      })
      .select()
      .single();

    if (data) {
      setState({
        activeSessionId: data.id,
        activeProjectId: projectId,
        startedAt: now,
        elapsed: 0,
      });
    }
  }, [state.activeSessionId]);

  const stop = useCallback(async () => {
    if (!state.activeSessionId) return null;

    const { data } = await db
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


