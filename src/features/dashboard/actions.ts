import type { DashboardActionDescriptor } from "@/features/dashboard/types";

export interface DashboardActionHandlers {
  respondToInvite: (eventId: string, responseStatus: "accepted" | "declined") => Promise<void>;
  moveTaskToInProgress: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  startTimer: (projectId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  markFinancialPaid: (financialEntryId: string) => Promise<void>;
  updateMeetingItemStatus: (meetingItemId: string, nextStatus: "pending" | "in_progress" | "resolved") => Promise<void>;
}

export function getDashboardActionKey(action: DashboardActionDescriptor) {
  return [
    action.kind,
    action.eventId || "",
    action.taskId || "",
    action.projectId || "",
    action.financialEntryId || "",
    action.meetingItemId || "",
    action.nextMeetingStatus || "",
  ].join(":");
}

export function getDashboardActionSuccessMessage(action: DashboardActionDescriptor) {
  switch (action.kind) {
    case "respond_accept":
      return "Reunião aceita.";
    case "respond_decline":
      return "Reunião recusada.";
    case "move_task_in_progress":
      return "Tarefa movida para Em andamento.";
    case "complete_task":
      return "Tarefa concluída.";
    case "start_timer":
      return "Timer iniciado.";
    case "stop_timer":
      return "Timer finalizado.";
    case "mark_financial_paid":
      return "Lançamento marcado como pago.";
    case "update_meeting_item_status":
      return action.nextMeetingStatus === "resolved"
        ? "Follow-up marcado como resolvido."
        : "Follow-up atualizado.";
    default:
      return null;
  }
}

export async function executeDashboardAction(
  action: DashboardActionDescriptor,
  handlers: DashboardActionHandlers,
) {
  switch (action.kind) {
    case "respond_accept":
    case "respond_decline":
      if (!action.eventId || !action.responseStatus) {
        throw new Error("Evento inválido para responder convite.");
      }
      await handlers.respondToInvite(action.eventId, action.responseStatus);
      return;
    case "move_task_in_progress":
      if (!action.taskId) {
        throw new Error("Tarefa inválida para iniciar.");
      }
      await handlers.moveTaskToInProgress(action.taskId);
      return;
    case "complete_task":
      if (!action.taskId) {
        throw new Error("Tarefa inválida para concluir.");
      }
      await handlers.completeTask(action.taskId);
      return;
    case "start_timer":
      if (!action.projectId) {
        throw new Error("Projeto inválido para iniciar timer.");
      }
      await handlers.startTimer(action.projectId);
      return;
    case "stop_timer":
      await handlers.stopTimer();
      return;
    case "mark_financial_paid":
      if (!action.financialEntryId) {
        throw new Error("Lançamento inválido para marcar como pago.");
      }
      await handlers.markFinancialPaid(action.financialEntryId);
      return;
    case "update_meeting_item_status":
      if (!action.meetingItemId || !action.nextMeetingStatus) {
        throw new Error("Item de ata inválido para atualização.");
      }
      await handlers.updateMeetingItemStatus(action.meetingItemId, action.nextMeetingStatus);
      return;
    default:
      return;
  }
}
