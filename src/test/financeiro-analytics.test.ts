import { describe, expect, it } from "vitest";
import {
  buildExecutiveSnapshot,
  buildMonthlyTrend,
  buildMissingForecastEntries,
  buildProjectionTimeline,
} from "@/features/financeiro/analytics";
import type { FinanceiroContractWithProject, FinanceiroEntryWithProject } from "@/features/financeiro/types";
import { getFinanceiroVisualStatus } from "@/features/financeiro/utils";

const baseEntry: FinanceiroEntryWithProject = {
  id: "entry_1",
  user_id: "user_123",
  project_id: "project_1",
  financial_contract_id: null,
  type: "income",
  category: "Retainer",
  title: "Golden Belle",
  description: null,
  counterparty_name: "Golden Belle",
  amount: 300,
  currency: "BRL",
  status: "pending",
  due_date: "2026-04-04",
  paid_at: null,
  competency_date: "2026-04-01",
  recurrence: "monthly",
  alert_days_before: 7,
  is_platform_cost: false,
  payment_url: null,
  notes: null,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  project: { id: "project_1", name: "Golden Belle", client: "Golden Belle", color: "#fff" },
  contract: null,
};

const baseContract: FinanceiroContractWithProject = {
  id: "contract_1",
  user_id: "user_123",
  project_id: "project_1",
  type: "expense",
  name: "Claude Code",
  counterparty_name: "Claude Code",
  category: "Software",
  amount: 110,
  currency: "BRL",
  recurrence: "monthly",
  due_day: 12,
  alert_days_before: 7,
  start_date: "2026-04-01",
  end_date: null,
  status: "active",
  payment_url: "https://claude.ai/settings/billing",
  is_platform_cost: true,
  notes: "Assinatura",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  project: { id: "project_1", name: "Golden Belle", client: "Golden Belle", color: "#fff" },
};

describe("financeiro analytics", () => {
  it("separa operacional do realizado mensal", () => {
    const snapshot = buildExecutiveSnapshot(
      [
        baseEntry,
        {
          ...baseEntry,
          id: "entry_2",
          type: "expense",
          title: "Claude Code",
          amount: 110,
          due_date: "2026-04-12",
          competency_date: "2026-04-01",
          counterparty_name: "Claude Code",
          category: "Software",
        },
        {
          ...baseEntry,
          id: "entry_3",
          type: "income",
          title: "Golden Belle pago",
          amount: 300,
          paid_at: "2026-04-02T10:00:00.000Z",
          status: "paid",
        },
      ],
      "competence",
      getFinanceiroVisualStatus,
      new Date("2026-04-01T12:00:00.000Z"),
      "month",
    );

    expect(snapshot.operation.receivableNow).toBe(300);
    expect(snapshot.operation.payableNow).toBe(0);
    expect(snapshot.selectedPeriod.income).toBe(600);
    expect(snapshot.selectedPeriod.expense).toBe(110);
    expect(snapshot.selectedPeriod.planned).toBe(190);
    expect(snapshot.selectedPeriod.breakdown.map((entry) => entry.id)).toEqual(["entry_1", "entry_2", "entry_3"]);
  });

  it("alinha resumo por periodo e composicao do total em 6 meses", () => {
    const snapshot = buildExecutiveSnapshot(
      [
        { ...baseEntry, id: "jan", amount: 1000, due_date: "2026-01-12", competency_date: "2026-01-01" },
        { ...baseEntry, id: "fev", amount: 1100, due_date: "2026-02-12", competency_date: "2026-02-01" },
        { ...baseEntry, id: "mar", amount: 1200, due_date: "2026-03-12", competency_date: "2026-03-01" },
        { ...baseEntry, id: "abr", amount: 1300, due_date: "2026-04-12", competency_date: "2026-04-01" },
        { ...baseEntry, id: "fora", amount: 999, due_date: "2025-12-12", competency_date: "2025-12-01" },
      ],
      "competence",
      getFinanceiroVisualStatus,
      new Date("2026-04-01T12:00:00.000Z"),
      "6m",
    );

    expect(snapshot.selectedPeriod.income).toBe(4600);
    expect(snapshot.selectedPeriod.breakdown.map((entry) => entry.id)).toEqual(["jan", "fev", "mar", "abr"]);
    expect(snapshot.fixedKpis.income6m).toBe(4600);
  });

  it("gera serie mensal coerente com o preset selecionado", () => {
    const trend = buildMonthlyTrend(
      [
        { ...baseEntry, id: "nov", amount: 800, due_date: "2025-11-12", competency_date: "2025-11-01" },
        { ...baseEntry, id: "dez", amount: 900, due_date: "2025-12-12", competency_date: "2025-12-01" },
        { ...baseEntry, id: "jan", amount: 1000, due_date: "2026-01-12", competency_date: "2026-01-01" },
        { ...baseEntry, id: "fev", amount: 1100, due_date: "2026-02-12", competency_date: "2026-02-01" },
        { ...baseEntry, id: "mar", amount: 1200, due_date: "2026-03-12", competency_date: "2026-03-01" },
        { ...baseEntry, id: "abr", amount: 1300, due_date: "2026-04-12", competency_date: "2026-04-01" },
      ],
      "competence",
      new Date("2026-04-01T12:00:00.000Z"),
      "6m",
    );

    expect(trend).toHaveLength(6);
    expect(trend.map((point) => point.monthKey)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
    expect(trend[5]?.income).toBe(1300);
  });

  it("projeta meses futuros sem somar lancamentos fora do horizonte", () => {
    const projection = buildProjectionTimeline(
      [
        { ...baseEntry, due_date: "2026-04-04", competency_date: "2026-04-01", amount: 300 },
        { ...baseEntry, id: "entry_2", type: "expense", amount: 110, due_date: "2026-05-12", competency_date: "2026-05-01" },
        { ...baseEntry, id: "entry_3", amount: 700, due_date: "2026-11-12", competency_date: "2026-11-01" },
      ],
      [],
      new Date("2026-04-01T12:00:00.000Z"),
      6,
    );

    expect(projection).toHaveLength(6);
    expect(projection[0]?.income).toBe(300);
    expect(projection[1]?.expense).toBe(110);
    expect(projection.some((point) => point.income === 700)).toBe(false);
  });

  it("completa a projecao com contratos ativos quando faltam parcelas materializadas", () => {
    const projection = buildProjectionTimeline(
      [
        {
          ...baseEntry,
          id: "golden_abril",
          financial_contract_id: "contract_golden",
          title: "Serviços de automação de WhatsApp",
          amount: 300,
          due_date: "2026-04-05",
          competency_date: "2026-04-01",
        },
      ],
      [
        {
          ...baseContract,
          id: "contract_golden",
          type: "income",
          name: "Serviços de automação de WhatsApp",
          counterparty_name: "Golden Belle",
          amount: 300,
          due_day: 5,
          start_date: "2025-12-01",
          project: { id: "project_1", name: "Golden Belle", client: "Golden Belle", color: "#fff" },
        },
      ],
      new Date("2026-04-01T12:00:00.000Z"),
      3,
    );

    expect(projection).toHaveLength(3);
    expect(projection[0]?.income).toBe(300);
    expect(projection[1]?.income).toBe(300);
    expect(projection[2]?.income).toBe(300);
  });

  it("gera apenas parcelas faltantes por contrato, competencia e vencimento", () => {
    const missing = buildMissingForecastEntries(
      [baseContract],
      [
        {
          ...baseEntry,
          id: "existing_april",
          financial_contract_id: "contract_1",
          type: "expense",
          title: "Claude Code",
          amount: 110,
          due_date: "2026-04-12",
          competency_date: "2026-04-01",
          counterparty_name: "Claude Code",
          category: "Software",
          recurrence: "monthly",
          is_platform_cost: true,
          payment_url: "https://claude.ai/settings/billing",
        },
      ],
      new Date("2026-04-01T12:00:00.000Z"),
      3,
    );

    expect(missing).toHaveLength(2);
    expect(missing[0]?.due_date).toBe("2026-05-12");
    expect(missing[1]?.due_date).toBe("2026-06-12");
    expect(missing.every((entry) => entry.payment_url === "https://claude.ai/settings/billing")).toBe(true);
  });
});
