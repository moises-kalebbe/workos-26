import type { SupabaseClient } from "@supabase/supabase-js";

export type QuickStartDailyMetric = {
  date: string;
  startedCount: number;
};

export type QuickStartWeeklyMetrics = {
  totalStarted: number;
  averagePerDay: number;
  activeDays: number;
  daily: QuickStartDailyMetric[];
};

type QuickStartEventRow = {
  created_at: string;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(days: number, now: Date): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(toDateKey(d));
  }
  return dates;
}

export async function getQuickStartWeeklyMetrics(params: {
  db: SupabaseClient;
  userId: string;
  days?: number;
  now?: Date;
}): Promise<QuickStartWeeklyMetrics> {
  const days = params.days || 7;
  const now = params.now || new Date();
  const fromDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await params.db
    .from("quick_start_events")
    .select("created_at")
    .eq("user_id", params.userId)
    .eq("event_name", "focus_session_started")
    .gte("created_at", fromDate)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return buildQuickStartWeeklyMetricsFromRows((data || []) as QuickStartEventRow[], days, now);
}

export function buildQuickStartWeeklyMetricsFromRows(
  rows: QuickStartEventRow[],
  days: number,
  now: Date,
): QuickStartWeeklyMetrics {
  const countsByDay = new Map<string, number>();
  rows.forEach((row) => {
    const dateKey = toDateKey(new Date(row.created_at));
    countsByDay.set(dateKey, (countsByDay.get(dateKey) || 0) + 1);
  });

  const daily = getDateRange(days, now).map((date) => ({
    date,
    startedCount: countsByDay.get(date) || 0,
  }));

  const totalStarted = daily.reduce((acc, item) => acc + item.startedCount, 0);
  const activeDays = daily.filter((item) => item.startedCount > 0).length;

  return {
    totalStarted,
    averagePerDay: Number((totalStarted / days).toFixed(2)),
    activeDays,
    daily,
  };
}

export function getQuickStart30dEvaluationSummary(metrics: QuickStartWeeklyMetrics & {
  windowDays: number;
}) {
  const recommendation =
    metrics.averagePerDay >= 1.2
      ? "Manter heuristica atual e iniciar experimento adaptativo."
      : "Manter heuristica fixa e revisar pesos semanalmente antes de evoluir para adaptativo.";

  return {
    sessionsPerDay: metrics.averagePerDay,
    totalSessions: metrics.totalStarted,
    activeDays: metrics.activeDays,
    recommendation,
  };
}
