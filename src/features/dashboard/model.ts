import { sortTasksForMatrix } from "@/lib/eisenhower";
import { getFinanceiroVisualStatus, parseFinanceiroDate } from "@/features/financeiro/utils";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { MeetingMinutesItem } from "@/types";
import type {
  BuildDashboardModelInput,
  DashboardActionDescriptor,
  DashboardAttentionItem,
  DashboardFinancialEntry,
  DashboardModuleSnapshot,
  DashboardPrimaryRecommendation,
  DashboardProject,
  DashboardProjectHealth,
  DashboardSecondBrainNote,
  DashboardSessionRow,
  DashboardTaskRow,
} from "@/features/dashboard/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const LIVE_OR_SOON_MINUTES = 30;
const MISSING_MINUTES_LOOKBACK_HOURS = 6;
const UPCOMING_FINANCE_DAYS = 7;
const STALE_TASK_DAYS = 2;
const INBOX_STALE_DAYS = 3;
const PROJECT_MEETING_LOOKAHEAD_HOURS = 48;

const ATTENTION_ORDER: Record<DashboardAttentionItem["type"], number> = {
  meeting_live_or_soon: 0,
  finance_overdue: 1,
  task_overdue: 2,
  task_due_today: 3,
  meeting_missing_minutes: 4,
  meeting_minutes_pending: 5,
  finance_upcoming: 6,
  task_stale_in_progress: 7,
  second_brain_inbox: 8,
};

const HEALTH_ORDER: Record<DashboardProjectHealth["level"], number> = {
  at_risk: 0,
  attention: 1,
  stable: 2,
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatMeetingTime(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return `${startDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatMeetingMoment(start: Date, now: Date) {
  if (isSameDay(start, now)) {
    return start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  return start.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatProjectName(projectId: string | null, projectName: string | null, fallbackLabel: string | null) {
  if (projectId && projectName) return projectName;
  if (projectName) return projectName;
  if (fallbackLabel) return fallbackLabel;
  return "Conhecimento geral";
}

function getTaskDayDiff(dueDate: string | null, now: Date) {
  if (!dueDate) return null;

  const due = parseFinanceiroDate(dueDate);
  const dueStart = startOfDay(due).getTime();
  const today = startOfDay(now).getTime();
  return Math.floor((dueStart - today) / DAY_MS);
}

function isMeetingCandidate(event: CalendarEvent) {
  return event.selfResponseStatus !== "declined";
}

function getProjectMap(projects: DashboardProject[]) {
  return new Map(projects.map((project) => [project.id, project]));
}

function getLatestSessionByProject(sessions: DashboardSessionRow[]) {
  const latestByProject = new Map<string, number>();

  for (const session of sessions) {
    const activityAt = new Date(session.ended_at || session.started_at).getTime();
    if (!Number.isFinite(activityAt)) continue;

    const current = latestByProject.get(session.project_id) || 0;
    if (activityAt > current) {
      latestByProject.set(session.project_id, activityAt);
    }
  }

  return latestByProject;
}

function buildMeetingActions(event: CalendarEvent): Pick<DashboardAttentionItem, "primaryAction" | "secondaryAction"> {
  if (event.canRespond && event.selfResponseStatus !== "accepted") {
    return {
      primaryAction: {
        kind: "respond_accept",
        label: "Aceitar",
        eventId: event.id,
        responseStatus: "accepted",
      },
      secondaryAction: {
        kind: "respond_decline",
        label: "Recusar",
        eventId: event.id,
        responseStatus: "declined",
      },
    };
  }

  if (event.meetLink) {
    return {
      primaryAction: {
        kind: "join_meeting",
        label: "Entrar no Meet",
        href: event.meetLink,
        external: true,
        eventId: event.id,
      },
      secondaryAction: {
        kind: "open_agenda",
        label: "Abrir agenda",
        href: "/agenda?preset=today",
      },
    };
  }

  return {
    primaryAction: {
      kind: "open_agenda",
      label: "Abrir agenda",
      href: "/agenda?preset=today",
    },
    secondaryAction: {
      kind: "open_atas",
      label: "Ver atas",
      href: `/atas?meeting=${encodeURIComponent(event.id)}`,
    },
  };
}

function buildTaskActions(
  task: DashboardTaskRow,
  projectId: string | null,
  preset: "overdue" | "today" | "recommended",
): Pick<DashboardAttentionItem, "primaryAction" | "secondaryAction"> {
  const defaultSecondaryAction: DashboardActionDescriptor = {
    kind: "open_kanban",
    label: "Abrir no Kanban",
    href: `/kanban?preset=${preset}`,
  };

  if (task.column_index === 1) {
    return {
      primaryAction: {
        kind: "complete_task",
        label: "Concluir",
        taskId: task.id,
      },
      secondaryAction: projectId
        ? {
            kind: "start_timer",
            label: "Iniciar timer",
            projectId,
          }
        : defaultSecondaryAction,
    };
  }

  return {
    primaryAction: {
      kind: "move_task_in_progress",
      label: "Iniciar agora",
      taskId: task.id,
    },
    secondaryAction: projectId
      ? {
          kind: "start_timer",
          label: "Iniciar timer",
          projectId,
        }
      : defaultSecondaryAction,
  };
}

function buildFinancialActions(entry: DashboardFinancialEntry): Pick<DashboardAttentionItem, "primaryAction" | "secondaryAction"> {
  if (entry.payment_url) {
    return {
      primaryAction: {
        kind: "open_payment_url",
        label: "Abrir pagamento",
        href: entry.payment_url,
        external: true,
        financialEntryId: entry.id,
      },
      secondaryAction: {
        kind: "mark_financial_paid",
        label: "Marcar como pago",
        financialEntryId: entry.id,
      },
    };
  }

  return {
    primaryAction: {
      kind: "mark_financial_paid",
      label: "Marcar como pago",
      financialEntryId: entry.id,
    },
    secondaryAction: {
      kind: "open_financeiro",
      label: "Abrir financeiro",
      href: `/financeiro?tab=executivo&status=${getFinanceiroVisualStatus(entry) === "overdue" ? "overdue" : "upcoming"}`,
    },
  };
}

function buildMeetingMinutesActions(item: MeetingMinutesItem): Pick<DashboardAttentionItem, "primaryAction" | "secondaryAction"> {
  if (item.status === "in_progress") {
    return {
      primaryAction: {
        kind: "update_meeting_item_status",
        label: "Marcar resolvido",
        meetingItemId: item.id,
        nextMeetingStatus: "resolved",
      },
      secondaryAction: {
        kind: "open_atas",
        label: "Abrir ata",
        href: `/atas?meeting=${encodeURIComponent(item.meeting_event_id)}`,
      },
    };
  }

  return {
    primaryAction: {
      kind: "update_meeting_item_status",
      label: "Iniciar follow-up",
      meetingItemId: item.id,
      nextMeetingStatus: "in_progress",
    },
    secondaryAction: {
      kind: "open_atas",
      label: "Abrir ata",
      href: `/atas?meeting=${encodeURIComponent(item.meeting_event_id)}`,
    },
  };
}

function buildSecondBrainActions(): Pick<DashboardAttentionItem, "primaryAction" | "secondaryAction"> {
  return {
    primaryAction: {
      kind: "open_second_brain",
      label: "Abrir inbox",
      href: "/second-brain?status=inbox",
    },
    secondaryAction: {
      kind: "open_second_brain",
      label: "Ver second brain",
      href: "/second-brain?status=inbox",
    },
  };
}

function buildTaskTitle(task: DashboardTaskRow, projectMap: Map<string, DashboardProject>) {
  return formatProjectName(task.project_id, task.project_id ? projectMap.get(task.project_id)?.name || null : null, task.client);
}

function getUpcomingMeetingLabel(events: CalendarEvent[], now: Date, lookAheadHours: number) {
  const horizon = now.getTime() + lookAheadHours * HOUR_MS;
  const upcoming = events
    .filter((event) => event.projectId)
    .filter(isMeetingCandidate)
    .map((event) => ({ event, start: new Date(event.start) }))
    .filter(({ start }) => start.getTime() >= now.getTime() && start.getTime() <= horizon)
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  return upcoming;
}

function getProjectMeetingHealth(projectId: string, events: CalendarEvent[], now: Date) {
  const horizon = now.getTime() + PROJECT_MEETING_LOOKAHEAD_HOURS * HOUR_MS;
  const candidates = events
    .filter((event) => event.projectId === projectId)
    .filter(isMeetingCandidate)
    .map((event) => ({ event, start: new Date(event.start) }))
    .filter(({ start }) => start.getTime() >= now.getTime() && start.getTime() <= horizon)
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  const next = candidates[0]?.start || null;

  return {
    count: candidates.length,
    nextLabel: next ? formatMeetingMoment(next, now) : null,
  };
}

function getQueueBadgeLabel(type: DashboardAttentionItem["type"]) {
  switch (type) {
    case "meeting_live_or_soon":
      return "Reunião";
    case "finance_overdue":
      return "Financeiro vencido";
    case "task_overdue":
      return "Tarefa atrasada";
    case "task_due_today":
      return "Prazo hoje";
    case "meeting_missing_minutes":
      return "Ata pendente";
    case "meeting_minutes_pending":
      return "Follow-up";
    case "finance_upcoming":
      return "Próximo vencimento";
    case "task_stale_in_progress":
      return "Execução parada";
    case "second_brain_inbox":
      return "Inbox";
    default:
      return "Atenção";
  }
}

export function buildDashboardAttentionQueue(input: BuildDashboardModelInput): DashboardAttentionItem[] {
  const {
    now,
    projects,
    tasks,
    sessions,
    calendarEvents,
    financialEntries,
    meetingItems,
    secondBrainNotes,
    activeTimerProjectId,
  } = input;

  const projectMap = getProjectMap(projects);
  const latestSessionByProject = getLatestSessionByProject(sessions);
  const todayStart = startOfDay(now).getTime();
  const queue: DashboardAttentionItem[] = [];
  const seenTaskIds = new Set<string>();
  const seenFinanceIds = new Set<string>();
  const seenMeetingItemIds = new Set<string>();
  const meetingIdsWithMinutes = new Set(meetingItems.map((item) => item.meeting_event_id));

  const meetingCandidates = [...calendarEvents]
    .filter(isMeetingCandidate)
    .filter((event) => !event.allDay)
    .map((event) => ({
      event,
      start: new Date(event.start),
      end: new Date(event.end),
    }))
    .filter(({ start, end }) => {
      const live = start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
      const startsSoon = start.getTime() > now.getTime() && start.getTime() - now.getTime() <= LIVE_OR_SOON_MINUTES * 60 * 1000;
      return live || startsSoon;
    })
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  for (const { event, start, end } of meetingCandidates) {
    const isLive = start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
    queue.push({
      id: `meeting:${event.id}`,
      type: "meeting_live_or_soon",
      rank: 0,
      eyebrow: isLive ? "Acontecendo agora" : "Começa em breve",
      title: event.summary,
      description: isLive
        ? `Em andamento até ${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
        : `Começa às ${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      tone: isLive ? "danger" : "warning",
      badgeLabel: getQueueBadgeLabel("meeting_live_or_soon"),
      projectId: event.projectId,
      projectName: event.projectName,
      ...buildMeetingActions(event),
    });
  }

  const overdueFinance = financialEntries
    .filter((entry) => getFinanceiroVisualStatus(entry, now) === "overdue")
    .sort((left, right) => parseFinanceiroDate(left.due_date).getTime() - parseFinanceiroDate(right.due_date).getTime());

  for (const entry of overdueFinance) {
    seenFinanceIds.add(entry.id);
    queue.push({
      id: `finance:${entry.id}`,
      type: "finance_overdue",
      rank: 0,
      eyebrow: "Pagamento vencido",
      title: entry.title,
      description: `${entry.type === "income" ? "Cobrança" : "Pagamento"} vencida desde ${parseFinanceiroDate(entry.due_date).toLocaleDateString("pt-BR")}.`,
      tone: "danger",
      badgeLabel: getQueueBadgeLabel("finance_overdue"),
      projectId: entry.project_id,
      projectName: entry.project?.name || null,
      ...buildFinancialActions(entry),
    });
  }

  const overdueTasks = sortTasksForMatrix(
    tasks.filter((task) => task.column_index < 2 && (getTaskDayDiff(task.due_date, now) ?? Number.POSITIVE_INFINITY) < 0),
  );

  for (const task of overdueTasks) {
    seenTaskIds.add(task.id);
    queue.push({
      id: `task:${task.id}:overdue`,
      type: "task_overdue",
      rank: 0,
      eyebrow: task.column_index === 1 ? "Execução crítica" : "Tarefa atrasada",
      title: task.title,
      description: `${buildTaskTitle(task, projectMap)} · vencida em ${parseFinanceiroDate(task.due_date as string).toLocaleDateString("pt-BR")}.`,
      tone: "danger",
      badgeLabel: getQueueBadgeLabel("task_overdue"),
      projectId: task.project_id,
      projectName: task.project_id ? projectMap.get(task.project_id)?.name || null : null,
      ...buildTaskActions(task, task.project_id, "overdue"),
    });
  }

  const tasksDueToday = sortTasksForMatrix(
    tasks.filter((task) => task.column_index < 2 && getTaskDayDiff(task.due_date, now) === 0 && !seenTaskIds.has(task.id)),
  );

  for (const task of tasksDueToday) {
    seenTaskIds.add(task.id);
    queue.push({
      id: `task:${task.id}:today`,
      type: "task_due_today",
      rank: 0,
      eyebrow: "Entrega do dia",
      title: task.title,
      description: `${buildTaskTitle(task, projectMap)} · vence hoje.`,
      tone: "warning",
      badgeLabel: getQueueBadgeLabel("task_due_today"),
      projectId: task.project_id,
      projectName: task.project_id ? projectMap.get(task.project_id)?.name || null : null,
      ...buildTaskActions(task, task.project_id, "today"),
    });
  }

  const meetingWithoutMinutes = [...calendarEvents]
    .filter(isMeetingCandidate)
    .filter((event) => !meetingIdsWithMinutes.has(event.id))
    .map((event) => ({
      event,
      end: new Date(event.end),
    }))
    .filter(({ end }) => end.getTime() < now.getTime() && now.getTime() - end.getTime() <= MISSING_MINUTES_LOOKBACK_HOURS * HOUR_MS)
    .sort((left, right) => right.end.getTime() - left.end.getTime());

  for (const { event } of meetingWithoutMinutes) {
    queue.push({
      id: `meeting-missing-minutes:${event.id}`,
      type: "meeting_missing_minutes",
      rank: 0,
      eyebrow: "Reunião sem ata",
      title: event.summary,
      description: `${formatMeetingTime(event.start, event.end)} · abra a ata para registrar decisões e próximos passos.`,
      tone: "warning",
      badgeLabel: getQueueBadgeLabel("meeting_missing_minutes"),
      projectId: event.projectId,
      projectName: event.projectName,
      primaryAction: {
        kind: "open_atas",
        label: "Abrir ata",
        href: `/atas?meeting=${encodeURIComponent(event.id)}`,
      },
      secondaryAction: {
        kind: "open_agenda",
        label: "Abrir agenda",
        href: "/agenda?preset=today",
      },
    });
  }

  const unresolvedMeetingItems = [...meetingItems]
    .filter((item) => item.status === "pending" || item.status === "in_progress")
    .sort((left, right) => new Date(left.meeting_start_at).getTime() - new Date(right.meeting_start_at).getTime());

  for (const item of unresolvedMeetingItems) {
    seenMeetingItemIds.add(item.id);
    queue.push({
      id: `minutes:${item.id}`,
      type: "meeting_minutes_pending",
      rank: 0,
      eyebrow: item.status === "in_progress" ? "Follow-up em andamento" : "Pendência de reunião",
      title: item.title,
      description: `${item.meeting_summary} · ${formatMeetingMoment(new Date(item.meeting_start_at), now)}.`,
      tone: item.status === "in_progress" ? "info" : "warning",
      badgeLabel: getQueueBadgeLabel("meeting_minutes_pending"),
      projectId: null,
      projectName: null,
      ...buildMeetingMinutesActions(item),
    });
  }

  const financeUpcoming = financialEntries
    .filter((entry) => !seenFinanceIds.has(entry.id))
    .filter((entry) => getFinanceiroVisualStatus(entry, now) !== "paid")
    .filter((entry) => {
      const dayDiff = Math.floor((startOfDay(parseFinanceiroDate(entry.due_date)).getTime() - todayStart) / DAY_MS);
      return dayDiff >= 0 && dayDiff <= UPCOMING_FINANCE_DAYS;
    })
    .sort((left, right) => parseFinanceiroDate(left.due_date).getTime() - parseFinanceiroDate(right.due_date).getTime());

  for (const entry of financeUpcoming) {
    seenFinanceIds.add(entry.id);
    const dayDiff = Math.max(0, Math.floor((startOfDay(parseFinanceiroDate(entry.due_date)).getTime() - todayStart) / DAY_MS));
    queue.push({
      id: `finance:${entry.id}:upcoming`,
      type: "finance_upcoming",
      rank: 0,
      eyebrow: "Vencimento próximo",
      title: entry.title,
      description: `${entry.type === "income" ? "Cobrança" : "Pagamento"} em ${dayDiff === 0 ? "hoje" : `${dayDiff}d`} (${parseFinanceiroDate(entry.due_date).toLocaleDateString("pt-BR")}).`,
      tone: "warning",
      badgeLabel: getQueueBadgeLabel("finance_upcoming"),
      projectId: entry.project_id,
      projectName: entry.project?.name || null,
      ...buildFinancialActions(entry),
    });
  }

  const staleInProgressTasks = sortTasksForMatrix(
    tasks.filter((task) => task.column_index === 1)
      .filter((task) => !seenTaskIds.has(task.id))
      .filter((task) => Boolean(task.project_id))
      .filter((task) => {
        if (!task.project_id) return false;
        if (activeTimerProjectId === task.project_id) return false;

        const lastActivity = latestSessionByProject.get(task.project_id);
        if (!lastActivity) return true;
        return now.getTime() - lastActivity >= STALE_TASK_DAYS * DAY_MS;
      }),
  );

  for (const task of staleInProgressTasks) {
    queue.push({
      id: `task:${task.id}:stale`,
      type: "task_stale_in_progress",
      rank: 0,
      eyebrow: "Execução parada",
      title: task.title,
      description: `${buildTaskTitle(task, projectMap)} · sem registro de sessão há 2 dias ou mais.`,
      tone: "info",
      badgeLabel: getQueueBadgeLabel("task_stale_in_progress"),
      projectId: task.project_id,
      projectName: task.project_id ? projectMap.get(task.project_id)?.name || null : null,
      ...buildTaskActions(task, task.project_id, "recommended"),
    });
  }

  const staleInboxNotes = secondBrainNotes
    .filter((note) => note.status === "inbox")
    .filter((note) => {
      const reference = new Date(note.captured_at || note.created_at || note.updated_at);
      return now.getTime() - reference.getTime() >= INBOX_STALE_DAYS * DAY_MS;
    })
    .sort((left, right) => new Date(left.captured_at || left.created_at).getTime() - new Date(right.captured_at || right.created_at).getTime());

  for (const note of staleInboxNotes) {
    queue.push({
      id: `note:${note.id}`,
      type: "second_brain_inbox",
      rank: 0,
      eyebrow: "Inbox acumulando",
      title: note.title,
      description: `Nota aguardando organização há mais de ${INBOX_STALE_DAYS} dias.`,
      tone: "neutral",
      badgeLabel: getQueueBadgeLabel("second_brain_inbox"),
      projectId: note.project_id,
      projectName: note.project_id ? projectMap.get(note.project_id)?.name || null : null,
      ...buildSecondBrainActions(),
    });
  }

  return queue
    .sort((left, right) => {
      if (ATTENTION_ORDER[left.type] !== ATTENTION_ORDER[right.type]) {
        return ATTENTION_ORDER[left.type] - ATTENTION_ORDER[right.type];
      }
      return left.title.localeCompare(right.title, "pt-BR");
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

export function buildDashboardModuleSnapshot(
  input: BuildDashboardModelInput,
  attentionQueue: DashboardAttentionItem[],
): DashboardModuleSnapshot {
  const todayMeetingCount = input.calendarEvents
    .filter(isMeetingCandidate)
    .filter((event) => isSameDay(new Date(event.start), input.now))
    .length;

  const activeTimerProjectName =
    input.activeTimerProjectId
      ? input.projects.find((project) => project.id === input.activeTimerProjectId)?.name || null
      : null;

  return {
    liveOrSoonMeetingCount: attentionQueue.filter((item) => item.type === "meeting_live_or_soon").length,
    todayMeetingCount,
    openTaskCount: input.tasks.filter((task) => task.column_index < 2).length,
    overdueTaskCount: attentionQueue.filter((item) => item.type === "task_overdue").length,
    dueTodayTaskCount: attentionQueue.filter((item) => item.type === "task_due_today").length,
    actionableFinanceCount: attentionQueue.filter((item) => item.type === "finance_overdue" || item.type === "finance_upcoming").length,
    overdueFinanceCount: attentionQueue.filter((item) => item.type === "finance_overdue").length,
    pendingMeetingMinutesCount: input.meetingItems.filter((item) => item.status === "pending" || item.status === "in_progress").length,
    staleInProgressTaskCount: attentionQueue.filter((item) => item.type === "task_stale_in_progress").length,
    secondBrainInboxCount: input.secondBrainNotes.filter((note) => note.status === "inbox").length,
    activeTimerProjectId: input.activeTimerProjectId,
    activeTimerProjectName,
  };
}

function buildRecommendationContext(snapshot: DashboardModuleSnapshot) {
  const context: string[] = [];

  if (snapshot.activeTimerProjectName) {
    context.push(`Timer ativo em ${snapshot.activeTimerProjectName}`);
  }
  if (snapshot.overdueTaskCount > 0) {
    context.push(`${snapshot.overdueTaskCount} tarefa${snapshot.overdueTaskCount > 1 ? "s" : ""} atrasada${snapshot.overdueTaskCount > 1 ? "s" : ""}`);
  }
  if (snapshot.actionableFinanceCount > 0) {
    context.push(`${snapshot.actionableFinanceCount} item${snapshot.actionableFinanceCount > 1 ? "s" : ""} financeiro${snapshot.actionableFinanceCount > 1 ? "s" : ""} acionável${snapshot.actionableFinanceCount > 1 ? "eis" : ""}`);
  }
  if (snapshot.pendingMeetingMinutesCount > 0) {
    context.push(`${snapshot.pendingMeetingMinutesCount} follow-up${snapshot.pendingMeetingMinutesCount > 1 ? "s" : ""} de reunião`);
  }
  if (snapshot.todayMeetingCount > 0) {
    context.push(`${snapshot.todayMeetingCount} reunião${snapshot.todayMeetingCount > 1 ? "ões" : ""} hoje`);
  }

  return context.slice(0, 4);
}

export function buildDashboardPrimaryRecommendation(
  attentionQueue: DashboardAttentionItem[],
  snapshot: DashboardModuleSnapshot,
): DashboardPrimaryRecommendation {
  const context = buildRecommendationContext(snapshot);
  const topItem = attentionQueue[0];

  if (!topItem) {
    return {
      eyebrow: "Agora",
      title: "Dia sob controle",
      reason: "Nenhum item crítico apareceu na fila de atenção. Use a dashboard para avançar no que rende mais valor.",
      context,
      primaryAction: {
        kind: "open_kanban",
        label: "Abrir Kanban",
        href: "/kanban?preset=recommended",
      },
      secondaryAction: {
        kind: "open_agenda",
        label: "Abrir agenda",
        href: "/agenda?preset=today",
      },
      sourceItemId: null,
    };
  }

  return {
    eyebrow: "Agora",
    title: topItem.title,
    reason: topItem.description,
    context,
    primaryAction: topItem.primaryAction,
    secondaryAction: topItem.secondaryAction,
    sourceItemId: topItem.id,
  };
}

export function buildDashboardProjectHealth(input: BuildDashboardModelInput): DashboardProjectHealth[] {
  const {
    now,
    projects,
    tasks,
    sessions,
    calendarEvents,
    financialEntries,
  } = input;

  const latestSessionByProject = getLatestSessionByProject(sessions);
  const todayStart = startOfDay(now).getTime();
  const isAfterNoon = now.getHours() >= 12;

  return projects
    .map((project) => {
      const trackedSecondsToday = sessions.reduce((sum, session) => {
        if (session.project_id !== project.id) return sum;
        const startedAt = new Date(session.started_at);
        if (!isSameDay(startedAt, now)) return sum;

        if (session.ended_at) {
          return sum + (session.duration_seconds || 0);
        }

        return sum + Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
      }, 0);

      const targetSecondsToday = Math.max(0, Number(project.daily_agreed_hours || 0)) * 3600;
      const overdueTaskCount = tasks.filter((task) => task.project_id === project.id && task.column_index < 2 && (getTaskDayDiff(task.due_date, now) ?? Number.POSITIVE_INFINITY) < 0).length;
      const dueTodayTaskCount = tasks.filter((task) => task.project_id === project.id && task.column_index < 2 && getTaskDayDiff(task.due_date, now) === 0).length;
      const overdueFinanceCount = financialEntries.filter((entry) => entry.project_id === project.id && getFinanceiroVisualStatus(entry, now) === "overdue").length;
      const upcomingFinanceCount = financialEntries
        .filter((entry) => entry.project_id === project.id)
        .filter((entry) => {
          const status = getFinanceiroVisualStatus(entry, now);
          if (status === "paid" || status === "overdue") return false;
          const dayDiff = Math.floor((startOfDay(parseFinanceiroDate(entry.due_date)).getTime() - todayStart) / DAY_MS);
          return dayDiff >= 0 && dayDiff <= UPCOMING_FINANCE_DAYS;
        })
        .length;
      const meetingHealth = getProjectMeetingHealth(project.id, calendarEvents, now);

      let level: DashboardProjectHealth["level"] = "stable";
      let reason = "Operação estável.";

      if (overdueFinanceCount > 0) {
        level = "at_risk";
        reason = "Existe financeiro vencido.";
      } else if (overdueTaskCount > 0) {
        level = "at_risk";
        reason = "Existe tarefa atrasada.";
      } else if (isAfterNoon && targetSecondsToday > 0 && trackedSecondsToday < targetSecondsToday * 0.5) {
        level = "attention";
        reason = "Abaixo de 50% da meta diária.";
      } else if (dueTodayTaskCount > 0) {
        level = "attention";
        reason = "Há entrega vencendo hoje.";
      } else if (upcomingFinanceCount > 0) {
        level = "attention";
        reason = "Há financeiro em até 7 dias.";
      } else if (meetingHealth.count > 0) {
        level = "attention";
        reason = "Existe reunião nas próximas 48h.";
      }

      return {
        projectId: project.id,
        projectName: project.name,
        client: project.client,
        color: project.color,
        level,
        trackedSecondsToday,
        targetSecondsToday,
        overdueTaskCount,
        dueTodayTaskCount,
        overdueFinanceCount,
        upcomingFinanceCount,
        actionableFinanceCount: overdueFinanceCount + upcomingFinanceCount,
        meetingCount48h: meetingHealth.count,
        nextMeetingLabel: meetingHealth.nextLabel,
        reason,
      };
    })
    .sort((left, right) => {
      if (HEALTH_ORDER[left.level] !== HEALTH_ORDER[right.level]) {
        return HEALTH_ORDER[left.level] - HEALTH_ORDER[right.level];
      }
      if (left.overdueFinanceCount !== right.overdueFinanceCount) {
        return right.overdueFinanceCount - left.overdueFinanceCount;
      }
      if (left.overdueTaskCount !== right.overdueTaskCount) {
        return right.overdueTaskCount - left.overdueTaskCount;
      }
      if (left.dueTodayTaskCount !== right.dueTodayTaskCount) {
        return right.dueTodayTaskCount - left.dueTodayTaskCount;
      }
      if (left.actionableFinanceCount !== right.actionableFinanceCount) {
        return right.actionableFinanceCount - left.actionableFinanceCount;
      }
      return left.projectName.localeCompare(right.projectName, "pt-BR");
    });
}

export function buildDashboardModel(input: BuildDashboardModelInput) {
  const attentionQueue = buildDashboardAttentionQueue(input);
  const moduleSnapshot = buildDashboardModuleSnapshot(input, attentionQueue);
  const primaryRecommendation = buildDashboardPrimaryRecommendation(attentionQueue, moduleSnapshot);
  const projectHealth = buildDashboardProjectHealth(input);

  return {
    attentionQueue,
    moduleSnapshot,
    primaryRecommendation,
    projectHealth,
  };
}


