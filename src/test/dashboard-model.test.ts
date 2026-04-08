import { describe, expect, it } from "vitest";
import { buildDashboardAttentionQueue, buildDashboardProjectHealth } from "@/features/dashboard/model";
import type {
  BuildDashboardModelInput,
  DashboardFinancialEntry,
  DashboardProject,
  DashboardSessionRow,
  DashboardTaskRow,
} from "@/features/dashboard/types";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { MeetingMinutesItem } from "@/types";

const NOW = new Date("2026-04-08T15:00:00.000Z");

function makeProject(overrides: Partial<DashboardProject> = {}): DashboardProject {
  return {
    id: "project-1",
    name: "Projeto Alpha",
    client: "Cliente Alpha",
    hourly_rate: 200,
    daily_agreed_hours: 4,
    color: "#22c55e",
    status: "active",
    ...overrides,
  };
}

function makeTask(overrides: Partial<DashboardTaskRow> = {}): DashboardTaskRow {
  return {
    id: "task-1",
    title: "Tarefa operacional",
    project_id: "project-1",
    skill_document_id: null,
    column_index: 0,
    priority: "high",
    urgency: "urgent",
    importance: "important",
    due_date: "2026-04-08",
    client: null,
    created_at: "2026-04-08T10:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<DashboardSessionRow> = {}): DashboardSessionRow {
  return {
    id: "session-1",
    project_id: "project-1",
    started_at: "2026-04-08T12:00:00.000Z",
    ended_at: "2026-04-08T13:00:00.000Z",
    duration_seconds: 3600,
    project: {
      id: "project-1",
      name: "Projeto Alpha",
      client: "Cliente Alpha",
      hourly_rate: 200,
      daily_agreed_hours: 4,
      color: "#22c55e",
    },
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    seriesKey: "series-1",
    recurringEventId: null,
    iCalUID: null,
    summary: "Reunião importante",
    description: null,
    location: null,
    start: "2026-04-08T15:10:00.000Z",
    end: "2026-04-08T15:40:00.000Z",
    allDay: false,
    htmlLink: "https://calendar.google.com/event-1",
    meetLink: "https://meet.google.com/alpha",
    status: "confirmed",
    colorId: null,
    priority: "high",
    tags: [],
    projectId: "project-1",
    projectName: "Projeto Alpha",
    selfResponseStatus: "accepted",
    canRespond: false,
    isOrganizer: false,
    ...overrides,
  };
}

function makeFinancialEntry(overrides: Partial<DashboardFinancialEntry> = {}): DashboardFinancialEntry {
  return {
    id: "finance-1",
    user_id: "user-1",
    project_id: "project-1",
    financial_contract_id: null,
    type: "expense",
    category: "Infra",
    title: "Conta operacional",
    description: null,
    counterparty_name: "Fornecedor",
    amount: 250,
    currency: "BRL",
    status: "pending",
    due_date: "2026-04-08",
    paid_at: null,
    competency_date: null,
    recurrence: "none",
    alert_days_before: 7,
    payment_url: "https://payments.example.com/1",
    notes: null,
    is_platform_cost: false,
    created_at: "2026-04-08T09:00:00.000Z",
    updated_at: "2026-04-08T09:00:00.000Z",
    project: {
      id: "project-1",
      name: "Projeto Alpha",
      client: "Cliente Alpha",
      color: "#22c55e",
    },
    contract: null,
    ...overrides,
  };
}

function makeMeetingItem(overrides: Partial<MeetingMinutesItem> = {}): MeetingMinutesItem {
  return {
    id: "minutes-1",
    user_id: "user-1",
    meeting_event_id: "event-minutes-1",
    meeting_series_key: "series-minutes-1",
    meeting_start_at: "2026-04-08T13:00:00.000Z",
    meeting_summary: "Weekly sync",
    title: "Enviar follow-up",
    detail: null,
    checklist_json: [],
    status: "pending",
    completed_at: null,
    created_at: "2026-04-08T13:10:00.000Z",
    updated_at: "2026-04-08T13:10:00.000Z",
    ...overrides,
  };
}

function buildInput(overrides: Partial<BuildDashboardModelInput> = {}): BuildDashboardModelInput {
  return {
    now: NOW,
    projects: [makeProject()],
    tasks: [],
    sessions: [],
    calendarEvents: [],
    financialEntries: [],
    meetingItems: [],
    activeTimerProjectId: null,
    ...overrides,
  };
}

describe("dashboard model", () => {
  it("ranks the attention queue using the fixed source order", () => {
    const input = buildInput({
      projects: [makeProject(), makeProject({ id: "project-2", name: "Projeto Beta", client: "Cliente Beta" })],
      calendarEvents: [
        makeEvent(),
        makeEvent({
          id: "event-without-minutes",
          seriesKey: "event-without-minutes",
          meetLink: null,
          canRespond: false,
          start: "2026-04-08T12:00:00.000Z",
          end: "2026-04-08T13:00:00.000Z",
        }),
      ],
      financialEntries: [
        makeFinancialEntry({ id: "finance-overdue", due_date: "2026-04-07" }),
        makeFinancialEntry({ id: "finance-upcoming", due_date: "2026-04-10", payment_url: null }),
      ],
      tasks: [
        makeTask({ id: "task-overdue", due_date: "2026-04-07" }),
        makeTask({ id: "task-today", due_date: "2026-04-08" }),
        makeTask({
          id: "task-stale",
          title: "Task stale",
          project_id: "project-2",
          due_date: null,
          column_index: 1,
        }),
      ],
      meetingItems: [
        makeMeetingItem({
          id: "minutes-pending",
          meeting_event_id: "event-minutes-1",
          title: "Registrar follow-up",
        }),
      ],
    });

    const queue = buildDashboardAttentionQueue(input);

    expect(queue.map((item) => item.type)).toEqual([
      "meeting_live_or_soon",
      "finance_overdue",
      "task_overdue",
      "task_due_today",
      "meeting_missing_minutes",
      "meeting_minutes_pending",
      "finance_upcoming",
      "task_stale_in_progress",
    ]);
  });

  it("detects recently ended meetings without minutes", () => {
    const queue = buildDashboardAttentionQueue(
      buildInput({
        calendarEvents: [
          makeEvent({
            id: "event-retro",
            meetLink: null,
            canRespond: false,
            start: "2026-04-08T11:00:00.000Z",
            end: "2026-04-08T12:30:00.000Z",
          }),
        ],
      }),
    );

    expect(queue.some((item) => item.type === "meeting_missing_minutes")).toBe(true);
  });

  it("falls back to safer quick actions when required links or project ids are missing", () => {
    const queue = buildDashboardAttentionQueue(
      buildInput({
        calendarEvents: [
          makeEvent({
            id: "event-no-meet",
            meetLink: null,
            canRespond: true,
            selfResponseStatus: "needsAction",
          }),
        ],
        financialEntries: [
          makeFinancialEntry({
            id: "finance-no-link",
            due_date: "2026-04-10",
            payment_url: null,
          }),
        ],
        tasks: [
          makeTask({
            id: "task-no-project",
            project_id: null,
            client: "Operação geral",
            due_date: "2026-04-08",
          }),
        ],
      }),
    );

    const meetingItem = queue.find((item) => item.id === "meeting:event-no-meet");
    const financeItem = queue.find((item) => item.id === "finance:finance-no-link:upcoming");
    const taskItem = queue.find((item) => item.id === "task:task-no-project:today");

    expect(meetingItem?.primaryAction.kind).toBe("respond_accept");
    expect(meetingItem?.secondaryAction?.kind).toBe("respond_decline");
    expect(financeItem?.primaryAction.kind).toBe("mark_financial_paid");
    expect(financeItem?.secondaryAction?.kind).toBe("open_financeiro");
    expect(taskItem?.secondaryAction?.kind).toBe("open_kanban");
    expect(taskItem?.secondaryAction?.href).toBe("/kanban?preset=today");
  });

  it("computes project health as at risk, attention and stable", () => {
    const projects = [
      makeProject({ id: "risk", name: "Projeto Risco", daily_agreed_hours: 4 }),
      makeProject({ id: "attention", name: "Projeto Atenção", daily_agreed_hours: 4 }),
      makeProject({ id: "stable", name: "Projeto Estável", daily_agreed_hours: 4 }),
    ];

    const health = buildDashboardProjectHealth(
      buildInput({
        projects,
        tasks: [makeTask({ id: "risk-task", project_id: "risk", due_date: "2026-04-07" })],
        sessions: [
          makeSession({ id: "attention-session", project_id: "attention", duration_seconds: 1800 }),
          makeSession({ id: "stable-session", project_id: "stable", duration_seconds: 10800 }),
        ],
        financialEntries: [makeFinancialEntry({ id: "risk-finance", project_id: "risk", due_date: "2026-04-07" })],
      }),
    );

    expect(health[0]).toMatchObject({
      projectId: "risk",
      level: "at_risk",
    });
    expect(health.find((item) => item.projectId === "attention")).toMatchObject({
      level: "attention",
    });
    expect(health.find((item) => item.projectId === "stable")).toMatchObject({
      level: "stable",
    });
  });
});
