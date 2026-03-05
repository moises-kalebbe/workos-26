import { describe, expect, it } from "vitest";
import {
  buildQuickStartWeeklyMetricsFromRows,
  getQuickStart30dEvaluationSummary,
} from "@/features/tracker/metrics";

describe("quick start metrics", () => {
  it("agrega eventos por dia e preenche dias sem evento", () => {
    const now = new Date("2026-03-07T12:00:00.000Z");
    const metrics = buildQuickStartWeeklyMetricsFromRows(
      [
        { created_at: "2026-03-07T08:00:00.000Z" },
        { created_at: "2026-03-07T11:00:00.000Z" },
        { created_at: "2026-03-05T10:00:00.000Z" },
      ],
      3,
      now,
    );

    expect(metrics.daily).toEqual([
      { date: "2026-03-05", startedCount: 1 },
      { date: "2026-03-06", startedCount: 0 },
      { date: "2026-03-07", startedCount: 2 },
    ]);
    expect(metrics.totalStarted).toBe(3);
    expect(metrics.activeDays).toBe(2);
    expect(metrics.averagePerDay).toBe(1);
  });

  it("gera recomendacao para evolucao adaptativa quando media e alta", () => {
    const summary = getQuickStart30dEvaluationSummary({
      totalStarted: 45,
      averagePerDay: 1.5,
      activeDays: 20,
      daily: [],
      windowDays: 30,
    });

    expect(summary.recommendation).toContain("experimento adaptativo");
  });
});

