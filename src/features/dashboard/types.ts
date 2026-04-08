import type { FinanceiroEntryWithProject } from "@/features/financeiro/types";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type {
  MeetingMinutesItem,
  MeetingMinutesStatus,
  Project,
  Task,
  TimeSession,
} from "@/types";

export type DashboardProject = Pick<
  Project,
  | "id"
  | "name"
  | "client"
  | "hourly_rate"
  | "daily_agreed_hours"
  | "color"
  | "status"
>;

export type DashboardSessionRow = Pick<
  TimeSession,
  "id" | "project_id" | "started_at" | "ended_at" | "duration_seconds"
> & {
  project?: Pick<DashboardProject, "id" | "name" | "client" | "hourly_rate" | "daily_agreed_hours" | "color"> | null;
};

export type DashboardTaskRow = Pick<
  Task,
  | "id"
  | "title"
  | "project_id"
  | "skill_document_id"
  | "column_index"
  | "priority"
  | "urgency"
  | "importance"
  | "due_date"
  | "client"
  | "created_at"
  | "completed_at"
>;

export type DashboardFinancialEntry = Pick<
  FinanceiroEntryWithProject,
  | "id"
  | "user_id"
  | "project_id"
  | "financial_contract_id"
  | "type"
  | "category"
  | "title"
  | "description"
  | "counterparty_name"
  | "amount"
  | "currency"
  | "status"
  | "due_date"
  | "paid_at"
  | "competency_date"
  | "recurrence"
  | "alert_days_before"
  | "payment_url"
  | "notes"
  | "is_platform_cost"
  | "created_at"
  | "updated_at"
  | "project"
  | "contract"
>;

export type DashboardActionKind =
  | "join_meeting"
  | "open_agenda"
  | "respond_accept"
  | "respond_decline"
  | "move_task_in_progress"
  | "complete_task"
  | "open_kanban"
  | "start_timer"
  | "stop_timer"
  | "mark_financial_paid"
  | "open_payment_url"
  | "open_financeiro"
  | "open_atas"
  | "update_meeting_item_status";

export type DashboardAttentionItemType =
  | "meeting_live_or_soon"
  | "finance_overdue"
  | "task_overdue"
  | "task_due_today"
  | "meeting_missing_minutes"
  | "meeting_minutes_pending"
  | "finance_upcoming"
  | "task_stale_in_progress";

export type DashboardProjectHealthLevel = "at_risk" | "attention" | "stable";
export type DashboardAttentionTone = "danger" | "warning" | "info" | "neutral";

export interface DashboardActionDescriptor {
  kind: DashboardActionKind;
  label: string;
  href?: string;
  external?: boolean;
  eventId?: string;
  responseStatus?: "accepted" | "declined";
  taskId?: string;
  projectId?: string | null;
  financialEntryId?: string;
  meetingItemId?: string;
  nextMeetingStatus?: MeetingMinutesStatus;
}

export interface DashboardAttentionItem {
  id: string;
  type: DashboardAttentionItemType;
  rank: number;
  eyebrow: string;
  title: string;
  description: string;
  tone: DashboardAttentionTone;
  badgeLabel: string;
  projectId: string | null;
  projectName: string | null;
  primaryAction: DashboardActionDescriptor;
  secondaryAction?: DashboardActionDescriptor;
}

export interface DashboardPrimaryRecommendation {
  eyebrow: string;
  title: string;
  reason: string;
  context: string[];
  primaryAction: DashboardActionDescriptor;
  secondaryAction?: DashboardActionDescriptor;
  sourceItemId: string | null;
}

export interface DashboardProjectHealth {
  projectId: string;
  projectName: string;
  client: string | null;
  color: string | null;
  level: DashboardProjectHealthLevel;
  trackedSecondsToday: number;
  targetSecondsToday: number;
  overdueTaskCount: number;
  dueTodayTaskCount: number;
  overdueFinanceCount: number;
  upcomingFinanceCount: number;
  actionableFinanceCount: number;
  meetingCount48h: number;
  nextMeetingLabel: string | null;
  reason: string;
}

export interface DashboardModuleSnapshot {
  liveOrSoonMeetingCount: number;
  todayMeetingCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  dueTodayTaskCount: number;
  actionableFinanceCount: number;
  overdueFinanceCount: number;
  pendingMeetingMinutesCount: number;
  staleInProgressTaskCount: number;
  activeTimerProjectId: string | null;
  activeTimerProjectName: string | null;
}

export interface BuildDashboardModelInput {
  now: Date;
  projects: DashboardProject[];
  tasks: DashboardTaskRow[];
  sessions: DashboardSessionRow[];
  calendarEvents: CalendarEvent[];
  financialEntries: DashboardFinancialEntry[];
  meetingItems: MeetingMinutesItem[];
  activeTimerProjectId: string | null;
}
