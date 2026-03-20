import { formatMoney } from "@/lib/utils";
import type { FinanceiroEntryWithProject, FinanceiroFilter, FinanceiroVisualStatus } from "@/features/financeiro/types";

export type FinanceiroMetrics = {
  receivableOpen: number;
  payableOpen: number;
  overdueTotal: number;
  upcomingTotal: number;
  overdueCount: number;
  upcomingCount: number;
  paidRecentCount: number;
  platformAlertCount: number;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getFinanceiroVisualStatus(
  entry: Pick<FinanceiroEntryWithProject, "status" | "due_date" | "paid_at" | "alert_days_before">,
  now = new Date(),
): FinanceiroVisualStatus {
  if (entry.status === "paid" || entry.paid_at) return "paid";

  const dueDate = startOfDay(new Date(entry.due_date));
  const today = startOfDay(now);

  if (entry.status === "overdue" || dueDate < today) return "overdue";

  const alertLimit = startOfDay(addDays(today, entry.alert_days_before ?? 7));
  if (dueDate <= alertLimit) return "upcoming";

  return "pending";
}

export function matchesFinanceiroFilter(
  entry: FinanceiroEntryWithProject,
  filter: FinanceiroFilter,
  now = new Date(),
) {
  const visualStatus = getFinanceiroVisualStatus(entry, now);

  switch (filter) {
    case "income":
      return entry.type === "income";
    case "expense":
      return entry.type === "expense";
    case "upcoming":
      return visualStatus === "upcoming";
    case "overdue":
      return visualStatus === "overdue";
    case "paid":
      return visualStatus === "paid";
    case "platform":
      return entry.is_platform_cost;
    default:
      return true;
  }
}

export function summarizeFinanceiro(entries: FinanceiroEntryWithProject[], now = new Date()): FinanceiroMetrics {
  return entries.reduce<FinanceiroMetrics>(
    (acc, entry) => {
      const visualStatus = getFinanceiroVisualStatus(entry, now);
      const isOpen = visualStatus !== "paid";

      if (entry.type === "income" && isOpen) {
        acc.receivableOpen += entry.amount;
      }

      if (entry.type === "expense" && isOpen) {
        acc.payableOpen += entry.amount;
      }

      if (visualStatus === "overdue") {
        acc.overdueTotal += entry.amount;
        acc.overdueCount += 1;
      }

      if (visualStatus === "upcoming") {
        acc.upcomingTotal += entry.amount;
        acc.upcomingCount += 1;
      }

      if (visualStatus === "paid") {
        acc.paidRecentCount += 1;
      }

      if (entry.is_platform_cost && visualStatus === "upcoming") {
        acc.platformAlertCount += 1;
      }

      return acc;
    },
    {
      receivableOpen: 0,
      payableOpen: 0,
      overdueTotal: 0,
      upcomingTotal: 0,
      overdueCount: 0,
      upcomingCount: 0,
      paidRecentCount: 0,
      platformAlertCount: 0,
    },
  );
}

export function sortFinanceiroEntries(entries: FinanceiroEntryWithProject[], now = new Date()) {
  return [...entries].sort((a, b) => {
    const statusOrder: Record<FinanceiroVisualStatus, number> = {
      overdue: 0,
      upcoming: 1,
      pending: 2,
      paid: 3,
    };

    const visualA = getFinanceiroVisualStatus(a, now);
    const visualB = getFinanceiroVisualStatus(b, now);

    if (statusOrder[visualA] !== statusOrder[visualB]) {
      return statusOrder[visualA] - statusOrder[visualB];
    }

    const dueDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (dueDiff !== 0) return dueDiff;

    return b.amount - a.amount;
  });
}

export function buildFinanceiroSearchText(entry: FinanceiroEntryWithProject) {
  return [
    entry.title,
    entry.category,
    entry.counterparty_name,
    entry.description,
    entry.notes,
    entry.project?.name,
    entry.project?.client,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function formatEntryTypeLabel(type: FinanceiroEntryWithProject["type"]) {
  return type === "income" ? "Entrada" : "Saida";
}

export function formatVisualStatusLabel(status: FinanceiroVisualStatus) {
  switch (status) {
    case "overdue":
      return "Atrasado";
    case "upcoming":
      return "Proximo";
    case "paid":
      return "Pago";
    default:
      return "Pendente";
  }
}

export function formatRecurrenceLabel(value: FinanceiroEntryWithProject["recurrence"]) {
  switch (value) {
    case "monthly":
      return "Mensal";
    case "yearly":
      return "Anual";
    default:
      return "Pontual";
  }
}

export function buildFinanceiroHeroRisk(metrics: FinanceiroMetrics) {
  if (metrics.overdueCount > 0) {
    return `${metrics.overdueCount} lancamento(s) atrasado(s) exigem acao imediata para evitar perda de controle financeiro.`;
  }

  if (metrics.platformAlertCount > 0) {
    return `${metrics.platformAlertCount} despesa(s) de plataforma vencem em breve e podem interromper operacao ou acesso.`;
  }

  return "Nenhum risco financeiro critico detectado no momento.";
}

export function buildFinanceiroHeroFocus(metrics: FinanceiroMetrics) {
  if (metrics.overdueCount > 0) {
    return `Priorize os atrasados e depois feche os ${metrics.upcomingCount} proximos vencimentos para manter o caixa previsivel.`;
  }

  if (metrics.upcomingCount > 0) {
    return `Existem ${metrics.upcomingCount} vencimento(s) nos proximos dias. Revise valores e confirme pagamentos antes do prazo.`;
  }

  return "O painel esta limpo. Use o modulo para registrar novas entradas e saidas manualmente.";
}

export function describeFinanceiroAmount(type: FinanceiroEntryWithProject["type"], amount: number) {
  return `${type === "income" ? "Receber" : "Pagar"} ${formatMoney(amount)}`;
}
