import type { AgendaPriority, CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { Task } from "@/types";

export const AGENDA_PRIORITIES: Array<{ value: AgendaPriority; label: string; badgeClass: string }> = [
  { value: "urgent", label: "Urgente", badgeClass: "bg-danger-muted text-danger border-danger/20" },
  { value: "high", label: "Alta", badgeClass: "bg-warning-muted text-warning border-warning/20" },
  { value: "normal", label: "Normal", badgeClass: "bg-info-muted text-info border-info/20" },
  { value: "low", label: "Baixa", badgeClass: "bg-secondary text-muted-foreground border-border" },
];

export const AGENDA_PRIORITY_ORDER: Record<AgendaPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const RESPONSE_STATUS_LABEL: Record<CalendarEvent["selfResponseStatus"], string> = {
  accepted: "Aceito",
  declined: "Recusado",
  needsAction: "Pendente",
  tentative: "Pendente",
  none: "Sem resposta",
};

export const KANBAN_PRIORITIES = [
  { value: "urgent", label: "Urgente", className: "bg-danger-muted text-danger" },
  { value: "high", label: "Alta", className: "bg-warning-muted text-warning" },
  { value: "normal", label: "Normal", className: "bg-info-muted text-info" },
  { value: "low", label: "Baixa", className: "bg-secondary text-muted-foreground" },
] as const satisfies ReadonlyArray<{
  value: Task["priority"];
  label: string;
  className: string;
}>;

export const KANBAN_URGENCY_OPTIONS = [
  { value: "urgent", label: "Urgente" },
  { value: "not_urgent", label: "Nao urgente" },
] as const;

export const KANBAN_IMPORTANCE_OPTIONS = [
  { value: "important", label: "Importante" },
  { value: "not_important", label: "Nao importante" },
] as const;

