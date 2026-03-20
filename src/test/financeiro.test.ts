import { describe, expect, it } from "vitest";
import {
  getFinanceiroVisualStatus,
  matchesFinanceiroFilter,
  summarizeFinanceiro,
} from "@/features/financeiro/utils";
import type { FinanceiroEntryWithProject } from "@/features/financeiro/types";

const baseEntry: FinanceiroEntryWithProject = {
  id: "1",
  user_id: "user",
  project_id: null,
  type: "expense",
  category: "Plataforma",
  title: "Figma",
  description: null,
  counterparty_name: "Figma",
  amount: 120,
  currency: "BRL",
  status: "pending",
  due_date: "2026-03-25",
  paid_at: null,
  competency_date: null,
  recurrence: "monthly",
  alert_days_before: 7,
  is_platform_cost: true,
  notes: null,
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  project: null,
};

describe("financeiro utils", () => {
  it("classifica lancamento pendente vencido como atrasado", () => {
    expect(getFinanceiroVisualStatus(baseEntry, new Date("2026-03-26T12:00:00.000Z"))).toBe("overdue");
  });

  it("classifica lancamento pago como pago", () => {
    expect(
      getFinanceiroVisualStatus(
        {
          ...baseEntry,
          status: "paid",
          paid_at: "2026-03-20T12:00:00.000Z",
        },
        new Date("2026-03-21T12:00:00.000Z"),
      ),
    ).toBe("paid");
  });

  it("filtra plataformas corretamente", () => {
    expect(matchesFinanceiroFilter(baseEntry, "platform", new Date("2026-03-20T12:00:00.000Z"))).toBe(true);
    expect(matchesFinanceiroFilter({ ...baseEntry, is_platform_cost: false }, "platform", new Date("2026-03-20T12:00:00.000Z"))).toBe(false);
  });

  it("resume totais abertos, vencidos e proximos", () => {
    const summary = summarizeFinanceiro(
      [
        { ...baseEntry, type: "income", amount: 2000, title: "Cliente A", counterparty_name: "Cliente A", due_date: "2026-03-23", is_platform_cost: false },
        { ...baseEntry, type: "expense", amount: 300, due_date: "2026-03-18", title: "Stripe", is_platform_cost: false },
        { ...baseEntry, type: "expense", amount: 120, due_date: "2026-03-24", title: "Figma" },
        { ...baseEntry, type: "income", amount: 1500, status: "paid", paid_at: "2026-03-19T12:00:00.000Z", due_date: "2026-03-19", title: "Cliente pago", counterparty_name: "Cliente Pago" },
      ],
      new Date("2026-03-20T12:00:00.000Z"),
    );

    expect(summary.receivableOpen).toBe(2000);
    expect(summary.payableOpen).toBe(420);
    expect(summary.overdueCount).toBe(1);
    expect(summary.upcomingCount).toBe(2);
    expect(summary.platformAlertCount).toBe(1);
    expect(summary.paidRecentCount).toBe(1);
  });
});
