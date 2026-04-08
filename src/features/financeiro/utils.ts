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

function normalizeFinanceiroAmount(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseFinanceiroDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map((chunk) => Number.parseInt(chunk, 10));
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function getFinanceiroVisualStatus(
  entry: Pick<FinanceiroEntryWithProject, "status" | "due_date" | "paid_at" | "alert_days_before">,
  now = new Date(),
): FinanceiroVisualStatus {
  if (entry.status === "paid" || entry.paid_at) return "paid";

  const dueDate = startOfDay(parseFinanceiroDate(entry.due_date));
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
      const isActionable = visualStatus === "upcoming" || visualStatus === "overdue";
      const amount = normalizeFinanceiroAmount(entry.amount);

      if (entry.type === "income" && isActionable) {
        acc.receivableOpen += amount;
      }

      if (entry.type === "expense" && isActionable) {
        acc.payableOpen += amount;
      }

      if (visualStatus === "overdue") {
        acc.overdueTotal += amount;
        acc.overdueCount += 1;
      }

      if (visualStatus === "upcoming") {
        acc.upcomingTotal += amount;
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

    const dueDiff = parseFinanceiroDate(a.due_date).getTime() - parseFinanceiroDate(b.due_date).getTime();
    if (dueDiff !== 0) return dueDiff;

    return normalizeFinanceiroAmount(b.amount) - normalizeFinanceiroAmount(a.amount);
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
      return "Próximo";
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

export function describeFinanceiroAmount(type: FinanceiroEntryWithProject["type"], amount: number) {
  return `${type === "income" ? "Receber" : "Pagar"} ${formatMoney(normalizeFinanceiroAmount(amount))}`;
}
