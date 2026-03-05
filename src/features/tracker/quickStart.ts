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

type ProjectRow = {
  id: string;
  name: string;
};

type TaskInsertRow = {
  id: string;
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

function getFallbackTaskTitle(now: Date): string {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `Foco rapido ${hh}:${mm}`;
}

async function resolveQuickStartProject(params: {
  db: SupabaseClient;
  userId: string;
  preferredProjectId?: string | null;
}): Promise<ProjectRow> {
  if (params.preferredProjectId) {
    const preferredRes = await params.db
      .from("projects")
      .select("id, name")
      .eq("id", params.preferredProjectId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (preferredRes.error) throw preferredRes.error;
    if (preferredRes.data) return preferredRes.data as ProjectRow;
  }

  const existingRes = await params.db
    .from("projects")
    .select("id, name")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRes.error) throw existingRes.error;
  if (existingRes.data) return existingRes.data as ProjectRow;

  const fallbackProject = {
    user_id: params.userId,
    name: "Projeto Rapido",
    client: "Quick Start",
    hourly_rate: 0,
    color: "#3b82f6",
  };

  const createdRes = await params.db
    .from("projects")
    .insert(fallbackProject)
    .select("id, name")
    .single();

  if (createdRes.error) throw createdRes.error;
  return createdRes.data as ProjectRow;
}

export async function createQuickStartFallbackTaskAndStart(params: {
  db: SupabaseClient;
  userId: string;
  timer: QuickStartTimer;
  taskTitle?: string;
  preferredProjectId?: string | null;
  requestId?: string;
  now?: Date;
}): Promise<{
  requestId: string;
  taskId: string;
  projectId: string;
  sessionId: string | null;
  taskTitle: string;
}> {
  const now = params.now || new Date();
  const requestId = params.requestId || createRequestId();
  const taskTitle = (params.taskTitle || "").trim() || getFallbackTaskTitle(now);

  const project = await resolveQuickStartProject({
    db: params.db,
    userId: params.userId,
    preferredProjectId: params.preferredProjectId,
  });

  const maxPosRes = await params.db
    .from("tasks")
    .select("position")
    .eq("user_id", params.userId)
    .eq("column_index", 1)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxPosRes.error) throw maxPosRes.error;

  const nextPosition = ((maxPosRes.data?.position as number | undefined) || 0) + 1;

  const taskInsertRes = await params.db
    .from("tasks")
    .insert({
      user_id: params.userId,
      project_id: project.id,
      title: taskTitle,
      column_index: 1,
      priority: "normal",
      urgency: "not_urgent",
      importance: "important",
      position: nextPosition,
      client: project.name,
      due_date: null,
    })
    .select("id")
    .single();

  if (taskInsertRes.error) throw taskInsertRes.error;

  const insertedTask = taskInsertRes.data as TaskInsertRow;

  await trackQuickStartEvent({
    db: params.db,
    userId: params.userId,
    eventName: "quick_start_fallback_created_task",
    payload: {
      requestId,
      taskId: insertedTask.id,
      projectId: project.id,
      taskTitle,
      source: "quick_start_fallback",
    },
  });

  const startedSession = await params.timer.start(project.id, params.userId, {
    origin: "quick_start",
    requestId,
    taskId: insertedTask.id,
  });

  await trackQuickStartEvent({
    db: params.db,
    userId: params.userId,
    eventName: "focus_session_started",
    payload: {
      requestId,
      taskId: insertedTask.id,
      projectId: project.id,
      sessionId: startedSession?.id || null,
      source: "quick_start_fallback",
    },
  });

  return {
    requestId,
    taskId: insertedTask.id,
    projectId: project.id,
    sessionId: startedSession?.id || null,
    taskTitle,
  };
}
