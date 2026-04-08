import { describe, expect, it, vi } from "vitest";
import {
  executeDashboardAction,
  getDashboardActionKey,
  getDashboardActionSuccessMessage,
  type DashboardActionHandlers,
} from "@/features/dashboard/actions";
import type { DashboardActionDescriptor } from "@/features/dashboard/types";

function createHandlers(): DashboardActionHandlers {
  return {
    respondToInvite: vi.fn().mockResolvedValue(undefined),
    moveTaskToInProgress: vi.fn().mockResolvedValue(undefined),
    completeTask: vi.fn().mockResolvedValue(undefined),
    startTimer: vi.fn().mockResolvedValue(undefined),
    stopTimer: vi.fn().mockResolvedValue(undefined),
    markFinancialPaid: vi.fn().mockResolvedValue(undefined),
    updateMeetingItemStatus: vi.fn().mockResolvedValue(undefined),
  };
}

describe("dashboard actions", () => {
  it("builds a stable action key", () => {
    const key = getDashboardActionKey({
      kind: "update_meeting_item_status",
      label: "Resolver",
      meetingItemId: "minutes-1",
      nextMeetingStatus: "resolved",
    });

    expect(key).toBe("update_meeting_item_status:::::minutes-1:resolved");
  });

  it("returns contextual success messages", () => {
    expect(
      getDashboardActionSuccessMessage({
        kind: "respond_accept",
        label: "Aceitar",
        eventId: "event-1",
        responseStatus: "accepted",
      }),
    ).toBe("Reunião aceita.");

    expect(
      getDashboardActionSuccessMessage({
        kind: "update_meeting_item_status",
        label: "Resolver",
        meetingItemId: "minutes-1",
        nextMeetingStatus: "resolved",
      }),
    ).toBe("Follow-up marcado como resolvido.");

    expect(
      getDashboardActionSuccessMessage({
        kind: "open_kanban",
        label: "Abrir no Kanban",
        href: "/kanban?preset=today",
      }),
    ).toBeNull();
  });

  it("dispatches quick actions to the correct handlers", async () => {
    const handlers = createHandlers();

    const actions: DashboardActionDescriptor[] = [
      {
        kind: "respond_accept",
        label: "Aceitar",
        eventId: "event-1",
        responseStatus: "accepted",
      },
      {
        kind: "move_task_in_progress",
        label: "Iniciar agora",
        taskId: "task-1",
      },
      {
        kind: "complete_task",
        label: "Concluir",
        taskId: "task-1",
      },
      {
        kind: "start_timer",
        label: "Iniciar timer",
        projectId: "project-1",
      },
      {
        kind: "stop_timer",
        label: "Parar timer",
      },
      {
        kind: "mark_financial_paid",
        label: "Marcar como pago",
        financialEntryId: "finance-1",
      },
      {
        kind: "update_meeting_item_status",
        label: "Resolver",
        meetingItemId: "minutes-1",
        nextMeetingStatus: "resolved",
      },
    ];

    for (const action of actions) {
      await executeDashboardAction(action, handlers);
    }

    expect(handlers.respondToInvite).toHaveBeenCalledWith("event-1", "accepted");
    expect(handlers.moveTaskToInProgress).toHaveBeenCalledWith("task-1");
    expect(handlers.completeTask).toHaveBeenCalledWith("task-1");
    expect(handlers.startTimer).toHaveBeenCalledWith("project-1");
    expect(handlers.stopTimer).toHaveBeenCalledOnce();
    expect(handlers.markFinancialPaid).toHaveBeenCalledWith("finance-1");
    expect(handlers.updateMeetingItemStatus).toHaveBeenCalledWith("minutes-1", "resolved");
  });

  it("fails fast when required identifiers are missing", async () => {
    const handlers = createHandlers();

    await expect(
      executeDashboardAction(
        {
          kind: "start_timer",
          label: "Iniciar timer",
          projectId: null,
        },
        handlers,
      ),
    ).rejects.toThrow("Projeto inválido para iniciar timer.");

    await expect(
      executeDashboardAction(
        {
          kind: "mark_financial_paid",
          label: "Marcar como pago",
        },
        handlers,
      ),
    ).rejects.toThrow("Lançamento inválido para marcar como pago.");

    expect(handlers.startTimer).not.toHaveBeenCalled();
    expect(handlers.markFinancialPaid).not.toHaveBeenCalled();
  });
});
