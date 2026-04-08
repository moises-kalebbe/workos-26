"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { applyMeetingMinutesStatus } from "@/features/atas/utils";
import { executeDashboardAction, getDashboardActionKey, getDashboardActionSuccessMessage } from "@/features/dashboard/actions";
import { buildDashboardModel } from "@/features/dashboard/model";
import type {
  DashboardActionDescriptor,
  DashboardFinancialEntry,
  DashboardProject,
  DashboardSecondBrainNote,
  DashboardSessionRow,
  DashboardTaskRow,
} from "@/features/dashboard/types";
import { summarizeFinanceiro } from "@/features/financeiro/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useTimer } from "@/hooks/useTimer";
import { db } from "@/lib/dbClient";
import {
  buildTimelineBlocks,
  buildTimelineHourLabels,
  getCurrentMinuteMarker,
  getDateKeyInTimezone,
  getSessionOverlapSecondsForDate,
} from "@/lib/timeline";
import type { MeetingMinutesItem } from "@/types";

export function useDashboardFeature() {
  const { user } = useAuth();
  const timer = useTimer();
  const {
    events: calendarEvents,
    loading: meetingsLoading,
    connected: meetingsConnected,
    fetchEvents,
    respondToInvite,
  } = useGoogleCalendar();

  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [tasks, setTasks] = useState<DashboardTaskRow[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionRow[]>([]);
  const [financialEntries, setFinancialEntries] = useState<DashboardFinancialEntry[]>([]);
  const [meetingItems, setMeetingItems] = useState<MeetingMinutesItem[]>([]);
  const [secondBrainNotes, setSecondBrainNotes] = useState<DashboardSecondBrainNote[]>([]);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timerId);
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setTasks([]);
      setSessions([]);
      setFinancialEntries([]);
      setMeetingItems([]);
      setSecondBrainNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const recentWindowIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profileRes,
      projectRes,
      taskRes,
      sessionRes,
      financialRes,
      meetingItemsRes,
      notesRes,
    ] = await Promise.all([
      db.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
      db
        .from("projects")
        .select("id, name, client, hourly_rate, daily_agreed_hours, color, status")
        .eq("user_id", user.id)
        .order("name"),
      db
        .from("tasks")
        .select("id, title, project_id, skill_document_id, column_index, priority, urgency, importance, due_date, client, created_at, completed_at")
        .eq("user_id", user.id)
        .lt("column_index", 2)
        .order("position"),
      db
        .from("time_sessions")
        .select("id, project_id, started_at, ended_at, duration_seconds, project:projects(id, name, client, hourly_rate, daily_agreed_hours, color)")
        .eq("user_id", user.id)
        .gte("started_at", recentWindowIso)
        .order("started_at", { ascending: false })
        .limit(400),
      db
        .from("financial_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),
      db
        .from("agenda_meeting_topics")
        .select("*")
        .eq("user_id", user.id)
        .order("meeting_start_at", { ascending: false }),
      db
        .from("second_brain_notes")
        .select("id, project_id, title, slug, status, captured_at, created_at, updated_at, tags")
        .eq("user_id", user.id)
        .order("captured_at", { ascending: false }),
    ]);

    if (profileRes.error) {
      toast.error("Não foi possível carregar o timezone do perfil.");
    } else if (profileRes.data?.timezone) {
      setTimezone(profileRes.data.timezone);
    }

    if (projectRes.error) {
      toast.error("Não foi possível carregar os projetos do cockpit.");
      setProjects([]);
    } else {
      setProjects((projectRes.data || []) as DashboardProject[]);
    }

    if (taskRes.error) {
      toast.error("Não foi possível carregar as tarefas do cockpit.");
      setTasks([]);
    } else {
      setTasks((taskRes.data || []) as DashboardTaskRow[]);
    }

    if (sessionRes.error) {
      toast.error("Não foi possível carregar a timeline do cockpit.");
      setSessions([]);
    } else {
      setSessions((sessionRes.data || []) as DashboardSessionRow[]);
    }

    if (financialRes.error) {
      toast.error("Não foi possível carregar o financeiro do cockpit.");
      setFinancialEntries([]);
    } else {
      setFinancialEntries((financialRes.data || []) as DashboardFinancialEntry[]);
    }

    if (meetingItemsRes.error) {
      toast.error("Não foi possível carregar os follow-ups de reunião.");
      setMeetingItems([]);
    } else {
      setMeetingItems((meetingItemsRes.data || []) as MeetingMinutesItem[]);
    }

    if (notesRes.error) {
      toast.error("Não foi possível carregar o inbox do second brain.");
      setSecondBrainNotes([]);
    } else {
      setSecondBrainNotes((notesRes.data || []) as DashboardSecondBrainNote[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!user) return;

    const timeMin = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    void fetchEvents(timeMin, timeMax);
  }, [fetchEvents, now, user]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const enrichedFinancialEntries = useMemo(
    () =>
      financialEntries.map((entry) => ({
        ...entry,
        project: entry.project_id ? projectMap.get(entry.project_id) || null : null,
      })),
    [financialEntries, projectMap],
  );

  const dashboardModel = useMemo(
    () =>
      buildDashboardModel({
        now,
        projects,
        tasks,
        sessions,
        calendarEvents,
        financialEntries: enrichedFinancialEntries,
        meetingItems,
        secondBrainNotes,
        activeTimerProjectId: timer.activeProjectId,
      }),
    [
      calendarEvents,
      enrichedFinancialEntries,
      meetingItems,
      now,
      projects,
      secondBrainNotes,
      sessions,
      tasks,
      timer.activeProjectId,
    ],
  );

  const timelineBlocks = useMemo(() => {
    return buildTimelineBlocks(
      sessions.map((session) => ({
        id: session.id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        projectName: session.project?.name || "Projeto sem nome",
        companyName: session.project?.client || null,
        hourlyRate: Number(session.project?.hourly_rate || 0),
        color: session.project?.color || null,
      })),
      timezone,
      now,
    );
  }, [now, sessions, timezone]);

  const timelineHourLabels = useMemo(() => buildTimelineHourLabels(3), []);
  const currentMinuteMarker = useMemo(() => getCurrentMinuteMarker(timezone, now), [now, timezone]);

  const financialMetrics = useMemo(
    () => summarizeFinanceiro(enrichedFinancialEntries, now),
    [enrichedFinancialEntries, now],
  );

  const todayMeetings = useMemo(() => {
    const todayKey = getDateKeyInTimezone(now, timezone);

    return [...calendarEvents]
      .filter((event) => event.selfResponseStatus !== "declined")
      .filter((event) => getDateKeyInTimezone(new Date(event.start), timezone) === todayKey)
      .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  }, [calendarEvents, now, timezone]);

  const trackedTodaySeconds = useMemo(() => {
    const todayKey = getDateKeyInTimezone(now, timezone);

    return sessions.reduce((sum, session) => {
      return sum + getSessionOverlapSecondsForDate(session.started_at, session.ended_at, timezone, todayKey, now);
    }, 0);
  }, [now, sessions, timezone]);

  const totalTargetSeconds = useMemo(
    () =>
      projects.reduce((sum, project) => sum + Math.max(0, Number(project.daily_agreed_hours || 0)) * 3600, 0),
    [projects],
  );

  const markFinancialPaid = useCallback(
    async (financialEntryId: string) => {
      const result = await db
        .from("financial_entries")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", financialEntryId);

      if (result.error) {
        throw new Error("Não foi possível marcar o lançamento como pago.");
      }

      await loadDashboardData();
    },
    [loadDashboardData],
  );

  const moveTaskToInProgress = useCallback(
    async (taskId: string) => {
      const result = await db
        .from("tasks")
        .update({
          column_index: 1,
          completed_at: null,
        })
        .eq("id", taskId);

      if (result.error) {
        throw new Error("Não foi possível mover a tarefa para Em andamento.");
      }

      await loadDashboardData();
    },
    [loadDashboardData],
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      const result = await db
        .from("tasks")
        .update({
          column_index: 2,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (result.error) {
        throw new Error("Não foi possível concluir a tarefa.");
      }

      await loadDashboardData();
    },
    [loadDashboardData],
  );

  const startTimer = useCallback(
    async (projectId: string) => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      await timer.start(projectId, user.id);
      await loadDashboardData();
    },
    [loadDashboardData, timer, user],
  );

  const stopTimer = useCallback(async () => {
    await timer.stop();
    await loadDashboardData();
  }, [loadDashboardData, timer]);

  const updateMeetingItemStatus = useCallback(
    async (meetingItemId: string, nextStatus: "pending" | "in_progress" | "resolved") => {
      const currentItem = meetingItems.find((item) => item.id === meetingItemId);
      if (!currentItem) {
        throw new Error("Follow-up de reunião não encontrado.");
      }

      const nextItem = applyMeetingMinutesStatus(currentItem, nextStatus, new Date().toISOString());
      const nextChecklist = currentItem.checklist_json.length
        ? currentItem.checklist_json.map((entry) => ({
            ...entry,
            completed: nextStatus === "resolved" ? true : nextStatus === "pending" ? false : entry.completed,
          }))
        : currentItem.checklist_json;

      const result = await db
        .from("agenda_meeting_topics")
        .update({
          status: nextItem.status,
          completed_at: nextItem.completed_at,
          checklist_json: nextChecklist,
        })
        .eq("id", meetingItemId);

      if (result.error) {
        throw new Error("Não foi possível atualizar o follow-up da reunião.");
      }

      await loadDashboardData();
    },
    [loadDashboardData, meetingItems],
  );

  const handleAction = useCallback(
    async (action: DashboardActionDescriptor) => {
      const key = getDashboardActionKey(action);
      setActingKey(key);

      try {
        await executeDashboardAction(action, {
          respondToInvite,
          moveTaskToInProgress,
          completeTask,
          startTimer,
          stopTimer,
          markFinancialPaid,
          updateMeetingItemStatus,
        });

        const successMessage = getDashboardActionSuccessMessage(action);
        if (successMessage) {
          toast.success(successMessage);
        }
      } catch (error) {
        toast.error((error as Error).message || "Não foi possível executar a ação rápida.");
      } finally {
        setActingKey(null);
      }
    },
    [
      completeTask,
      markFinancialPaid,
      moveTaskToInProgress,
      respondToInvite,
      startTimer,
      stopTimer,
      updateMeetingItemStatus,
    ],
  );

  return {
    loading,
    timezone,
    now,
    meetingsLoading,
    meetingsConnected,
    todayMeetings,
    financialMetrics,
    timelineBlocks,
    timelineHourLabels,
    currentMinuteMarker,
    trackedTodaySeconds,
    totalTargetSeconds,
    attentionQueue: dashboardModel.attentionQueue,
    moduleSnapshot: dashboardModel.moduleSnapshot,
    primaryRecommendation: dashboardModel.primaryRecommendation,
    projectHealth: dashboardModel.projectHealth,
    activeTimerProjectId: timer.activeProjectId,
    activeTimerElapsedSeconds: timer.elapsed,
    actingKey,
    handleAction,
    getActionKey: getDashboardActionKey,
    reload: loadDashboardData,
  };
}
