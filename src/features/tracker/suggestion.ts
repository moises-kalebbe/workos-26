import type { SupabaseClient } from "@supabase/supabase-js";

type TrackerTaskCandidateRow = {
  id: string;
  title: string;
  project_id: string | null;
  column_index: number;
  due_date: string | null;
  updated_at: string;
};

type TrackerSessionSnapshotRow = {
  project_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type QuickStartTaskCandidate = TrackerTaskCandidateRow & {
  project_id: string;
};

export type QuickStartScoredTask = {
  task: QuickStartTaskCandidate;
  score: number;
  reasons: string[];
  updatedAtMs: number;
};

export type QuickStartSuggestion = {
  task: QuickStartTaskCandidate;
  score: number;
  reasons: string[];
};

type QuickStartScoringContext = {
  now: Date;
  mostActiveProjectId: string | null;
  heavilyFocusedProjectIds: Set<string>;
};

const SCORE = {
  inProgress: 40,
  dueToday: 25,
  recentlyUpdated: 15,
  mostActiveProject: 10,
  heavilyFocusedPenalty: -20,
} as const;

const HEAVY_FOCUS_THRESHOLD_SECONDS = 45 * 60;
const DEFAULT_MIN_SCORE = 20;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSessionDurationSeconds(session: TrackerSessionSnapshotRow, now: Date): number {
  if (typeof session.duration_seconds === "number" && session.duration_seconds > 0) {
    return session.duration_seconds;
  }

  const startedAtMs = new Date(session.started_at).getTime();
  if (!Number.isFinite(startedAtMs)) return 0;

  if (!session.ended_at) {
    return Math.max(0, Math.floor((now.getTime() - startedAtMs) / 1000));
  }

  const endedAtMs = new Date(session.ended_at).getTime();
  if (!Number.isFinite(endedAtMs)) return 0;

  return Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));
}

function buildScoringContext(
  sessions: TrackerSessionSnapshotRow[],
  now: Date,
): QuickStartScoringContext {
  const weeklySessionCountByProject = new Map<string, number>();
  const focusedSecondsTodayByProject = new Map<string, number>();
  const todayKey = toDateKey(now);

  sessions.forEach((session) => {
    weeklySessionCountByProject.set(
      session.project_id,
      (weeklySessionCountByProject.get(session.project_id) || 0) + 1,
    );

    const startedAt = new Date(session.started_at);
    if (toDateKey(startedAt) !== todayKey) return;

    focusedSecondsTodayByProject.set(
      session.project_id,
      (focusedSecondsTodayByProject.get(session.project_id) || 0) + getSessionDurationSeconds(session, now),
    );
  });

  let mostActiveProjectId: string | null = null;
  let highestSessionCount = -1;

  weeklySessionCountByProject.forEach((count, projectId) => {
    if (count > highestSessionCount) {
      highestSessionCount = count;
      mostActiveProjectId = projectId;
    }
  });

  const heavilyFocusedProjectIds = new Set<string>();
  focusedSecondsTodayByProject.forEach((seconds, projectId) => {
    if (seconds >= HEAVY_FOCUS_THRESHOLD_SECONDS) {
      heavilyFocusedProjectIds.add(projectId);
    }
  });

  return {
    now,
    mostActiveProjectId,
    heavilyFocusedProjectIds,
  };
}

function isDueToday(dueDateIso: string | null, now: Date): boolean {
  if (!dueDateIso) return false;
  return dueDateIso === toDateKey(now);
}

function isRecentlyUpdated(updatedAtIso: string, now: Date): boolean {
  const updatedAtMs = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;
  return now.getTime() - updatedAtMs <= 24 * 60 * 60 * 1000;
}

export function scoreQuickStartTask(
  task: QuickStartTaskCandidate,
  context: QuickStartScoringContext,
): QuickStartScoredTask {
  let score = 0;
  const reasons: string[] = [];

  if (task.column_index === 1) {
    score += SCORE.inProgress;
    reasons.push("in_progress");
  }

  if (isDueToday(task.due_date, context.now)) {
    score += SCORE.dueToday;
    reasons.push("due_today");
  }

  if (isRecentlyUpdated(task.updated_at, context.now)) {
    score += SCORE.recentlyUpdated;
    reasons.push("recently_updated");
  }

  if (context.mostActiveProjectId && task.project_id === context.mostActiveProjectId) {
    score += SCORE.mostActiveProject;
    reasons.push("most_active_project_week");
  }

  if (context.heavilyFocusedProjectIds.has(task.project_id)) {
    score += SCORE.heavilyFocusedPenalty;
    reasons.push("heavily_focused_today_penalty");
  }

  return {
    task,
    score,
    reasons,
    updatedAtMs: new Date(task.updated_at).getTime(),
  };
}

export function rankQuickStartTasks(
  tasks: QuickStartTaskCandidate[],
  sessions: TrackerSessionSnapshotRow[],
  now: Date,
): QuickStartScoredTask[] {
  const context = buildScoringContext(sessions, now);

  return tasks
    .map((task) => scoreQuickStartTask(task, context))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return b.updatedAtMs - a.updatedAtMs;
    });
}

export function selectQuickStartSuggestion(
  rankedTasks: QuickStartScoredTask[],
  minScore = DEFAULT_MIN_SCORE,
): QuickStartSuggestion | null {
  const topCandidate = rankedTasks[0];
  if (!topCandidate) return null;
  if (topCandidate.score < minScore) return null;

  return {
    task: topCandidate.task,
    score: topCandidate.score,
    reasons: topCandidate.reasons,
  };
}

export async function getQuickStartSuggestion(params: {
  db: SupabaseClient;
  now?: Date;
  minScore?: number;
}): Promise<QuickStartSuggestion | null> {
  const now = params.now || new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [tasksRes, sessionsRes] = await Promise.all([
    params.db
      .from("tasks")
      .select("id, title, project_id, column_index, due_date, updated_at")
      .not("project_id", "is", null)
      .neq("column_index", 2)
      .order("updated_at", { ascending: false })
      .limit(50),
    params.db
      .from("time_sessions")
      .select("project_id, started_at, ended_at, duration_seconds")
      .gte("started_at", weekAgo)
      .order("started_at", { ascending: false })
      .limit(500),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const tasks = ((tasksRes.data || []) as TrackerTaskCandidateRow[]).filter(
    (task): task is QuickStartTaskCandidate => typeof task.project_id === "string",
  );
  const sessions = (sessionsRes.data || []) as TrackerSessionSnapshotRow[];

  const ranked = rankQuickStartTasks(tasks, sessions, now);
  return selectQuickStartSuggestion(ranked, params.minScore);
}

