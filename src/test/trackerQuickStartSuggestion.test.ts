import { describe, expect, it } from "vitest";
import {
  rankQuickStartTasks,
  selectQuickStartSuggestion,
  type QuickStartTaskCandidate,
} from "@/features/tracker/suggestion";

function makeTask(partial: Partial<QuickStartTaskCandidate>): QuickStartTaskCandidate {
  return {
    id: partial.id || "task-1",
    title: partial.title || "Task",
    project_id: partial.project_id || "project-1",
    column_index: partial.column_index ?? 0,
    due_date: partial.due_date ?? null,
    updated_at: partial.updated_at || "2026-03-05T12:00:00.000Z",
  };
}

describe("quick start suggestion scoring", () => {
  it("prioriza tarefa em andamento e com prazo no dia", () => {
    const now = new Date("2026-03-05T15:00:00.000Z");
    const ranked = rankQuickStartTasks(
      [
        makeTask({
          id: "strong-candidate",
          project_id: "project-1",
          column_index: 1,
          due_date: "2026-03-05",
          updated_at: "2026-03-05T14:30:00.000Z",
        }),
        makeTask({
          id: "weak-candidate",
          project_id: "project-2",
          column_index: 0,
          due_date: null,
          updated_at: "2026-03-03T11:00:00.000Z",
        }),
      ],
      [
        {
          project_id: "project-1",
          started_at: "2026-03-05T11:00:00.000Z",
          ended_at: "2026-03-05T12:00:00.000Z",
          duration_seconds: 3600,
        },
      ],
      now,
    );

    expect(ranked[0]?.task.id).toBe("strong-candidate");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score || 0);
  });

  it("desempata por updated_at mais recente quando score for igual", () => {
    const now = new Date("2026-03-05T15:00:00.000Z");
    const ranked = rankQuickStartTasks(
      [
        makeTask({
          id: "older",
          project_id: "project-1",
          updated_at: "2026-03-05T08:00:00.000Z",
        }),
        makeTask({
          id: "newer",
          project_id: "project-2",
          updated_at: "2026-03-05T12:00:00.000Z",
        }),
      ],
      [],
      now,
    );

    expect(ranked[0]?.score).toBe(ranked[1]?.score);
    expect(ranked[0]?.task.id).toBe("newer");
  });

  it("retorna null quando score maximo estiver abaixo do threshold", () => {
    const now = new Date("2026-03-05T15:00:00.000Z");
    const ranked = rankQuickStartTasks(
      [
        makeTask({
          id: "low-score",
          project_id: "project-1",
          column_index: 0,
          due_date: null,
          updated_at: "2026-03-01T08:00:00.000Z",
        }),
      ],
      [
        {
          project_id: "project-1",
          started_at: "2026-03-05T10:00:00.000Z",
          ended_at: "2026-03-05T11:00:00.000Z",
          duration_seconds: 3600,
        },
      ],
      now,
    );

    const suggestion = selectQuickStartSuggestion(ranked, 20);
    expect(suggestion).toBeNull();
  });
});

