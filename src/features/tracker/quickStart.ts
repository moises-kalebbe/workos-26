import type { SupabaseClient } from "@supabase/supabase-js";
import { trackQuickStartEvent } from "@/features/tracker/analytics";
import { getQuickStartSuggestion, type QuickStartSuggestion } from "@/features/tracker/suggestion";

type StartTimerOptions = {
  origin?: "quick_start" | "manual";
  requestId?: string;
  taskId?: string;
};

type StartedSession = {
  id: string;
};

type QuickStartTimer = {
  start: (
    projectId: string,
    userId: string,
    options?: StartTimerOptions,
  ) => Promise<StartedSession | null>;
};

export type QuickStartFlowResult =
  | {
      ok: true;
      requestId: string;
      suggestion: QuickStartSuggestion;
      sessionId: string | null;
    }
  | {
      ok: false;
      requestId: string;
      reason: "no_suggestion";
    };

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `qs_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function executeQuickStartFlow(params: {
  db: SupabaseClient;
  userId: string;
  timer: QuickStartTimer;
  now?: Date;
  minScore?: number;
  requestId?: string;
}): Promise<QuickStartFlowResult> {
  const requestId = params.requestId || createRequestId();

  await trackQuickStartEvent({
    db: params.db,
    userId: params.userId,
    eventName: "quick_start_clicked",
    payload: { requestId },
  });

  const suggestion = await getQuickStartSuggestion({
    db: params.db,
    now: params.now,
    minScore: params.minScore,
  });

  if (!suggestion) {
    await trackQuickStartEvent({
      db: params.db,
      userId: params.userId,
      eventName: "quick_start_no_suggestion",
      payload: { requestId },
    });

    return {
      ok: false,
      requestId,
      reason: "no_suggestion",
    };
  }

  await trackQuickStartEvent({
    db: params.db,
    userId: params.userId,
    eventName: "quick_start_suggestion_accepted",
    payload: {
      requestId,
      taskId: suggestion.task.id,
      projectId: suggestion.task.project_id,
      score: suggestion.score,
      reasons: suggestion.reasons,
    },
  });

  const startedSession = await params.timer.start(suggestion.task.project_id, params.userId, {
    origin: "quick_start",
    requestId,
    taskId: suggestion.task.id,
  });

  await trackQuickStartEvent({
    db: params.db,
    userId: params.userId,
    eventName: "focus_session_started",
    payload: {
      requestId,
      taskId: suggestion.task.id,
      projectId: suggestion.task.project_id,
      sessionId: startedSession?.id || null,
      source: "quick_start",
    },
  });

  return {
    ok: true,
    requestId,
    suggestion,
    sessionId: startedSession?.id || null,
  };
}

