import type {
  FinanceiroContractWithProject,
  FinanceiroEntryWithProject,
  FinanceiroReportingBasis,
  FinanceiroVisualStatus,
} from "@/features/financeiro/types";
import { parseFinanceiroDate } from "@/features/financeiro/utils";

export type FinanceiroPeriodPreset = "month" | "6m" | "12m" | "24m" | "custom";

export type FinanceiroExecutiveSnapshot = {
  operation: {
    receivableNow: number;
    payableNow: number;
    overdueCount: number;
    upcomingCount: number;
  };
  selectedPeriod: {
    preset: FinanceiroPeriodPreset;
    start: string;
    end: string;
    isMonthView: boolean;
    income: number;
    expense: number;
    profit: number;
    planned: number;
    breakdown: Array<{
      id: string;
      title: string;
      type: FinanceiroEntryWithProject["type"];
      amount: number;
      competency_date: string | null;
      due_date: string;
      contract_id: string | null;
      effective_date: string;
    }>;
  };
  fixedKpis: {
    income6m: number;
    expense6m: number;
    incomeYear: number;
    expenseYear: number;
  };
};

export type FinanceiroMonthlyTrendPoint = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  profit: number;
};

export type FinanceiroProjectionPoint = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  profit: number;
};

export type FinanceiroForecastEntryInput = Omit<FinanceiroEntryWithProject, "id" | "created_at" | "updated_at" | "project">;
type FinanceiroProjectionEntry = Pick<
  FinanceiroEntryWithProject,
  "type" | "amount" | "due_date" | "competency_date"
> | Pick<
  FinanceiroForecastEntryInput,
  "type" | "amount" | "due_date" | "competency_date"
>;

function normalizeFinanceiroAmount(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) return null;
  return toDateKey(startOfDay(parseFinanceiroDate(value)));
}

function getEntryDateByBasis(entry: FinanceiroEntryWithProject, basis: FinanceiroReportingBasis) {
  if (basis === "cash") {
    return entry.paid_at ? startOfDay(new Date(entry.paid_at)) : null;
  }

  return startOfDay(parseFinanceiroDate(entry.competency_date || entry.due_date));
}

function getProjectionDate(entry: FinanceiroProjectionEntry) {
  return startOfDay(parseFinanceiroDate(entry.competency_date || entry.due_date));
}

function isSettledEntry(entry: Pick<FinanceiroEntryWithProject, "status" | "paid_at">) {
  return entry.status === "paid" || Boolean(entry.paid_at);
}

function shouldReplaceDuplicateEntry(current: FinanceiroEntryWithProject, candidate: FinanceiroEntryWithProject) {
  const currentSettled = isSettledEntry(current);
  const candidateSettled = isSettledEntry(candidate);

  if (currentSettled !== candidateSettled) {
    return candidateSettled;
  }

  const currentPaidAt = current.paid_at ? new Date(current.paid_at).getTime() : Number.NEGATIVE_INFINITY;
  const candidatePaidAt = candidate.paid_at ? new Date(candidate.paid_at).getTime() : Number.NEGATIVE_INFINITY;

  if (currentPaidAt !== candidatePaidAt) {
    return candidatePaidAt > currentPaidAt;
  }

  const currentCreatedAt = new Date(current.created_at).getTime();
  const candidateCreatedAt = new Date(candidate.created_at).getTime();

  if (currentCreatedAt !== candidateCreatedAt) {
    return candidateCreatedAt < currentCreatedAt;
  }

  return candidate.id < current.id;
}

export function dedupeContractEntries(entries: FinanceiroEntryWithProject[]) {
  const duplicateIds = new Set<string>();
  const keepByKey = new Map<string, FinanceiroEntryWithProject>();

  for (const entry of entries) {
    if (!entry.financial_contract_id) continue;

    const competencyKey = normalizeDateKey(entry.competency_date) || normalizeDateKey(entry.due_date);
    const dueKey = normalizeDateKey(entry.due_date);
    const key = `${entry.financial_contract_id}:${competencyKey}:${dueKey}`;
    const current = keepByKey.get(key);

    if (!current) {
      keepByKey.set(key, entry);
      continue;
    }

    if (shouldReplaceDuplicateEntry(current, entry)) {
      duplicateIds.add(current.id);
      keepByKey.set(key, entry);
      continue;
    }

    duplicateIds.add(entry.id);
  }

  return {
    entries: entries.filter((entry) => !duplicateIds.has(entry.id)),
    duplicateIds: [...duplicateIds],
  };
}

export function getRangeFromPreset(
  now: Date,
  preset: FinanceiroPeriodPreset,
  customStart?: string,
  customEnd?: string,
) {
  if (preset === "custom" && customStart && customEnd) {
    return {
      start: startOfDay(parseFinanceiroDate(customStart)),
      end: startOfDay(parseFinanceiroDate(customEnd)),
    };
  }

  if (preset === "month") {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
    };
  }

  if (preset === "6m") {
    return {
      start: startOfMonth(addMonths(now, -5)),
      end: endOfMonth(now),
    };
  }

  if (preset === "12m") {
    return {
      start: startOfMonth(addMonths(now, -11)),
      end: endOfMonth(now),
    };
  }

  return {
    start: startOfMonth(addMonths(now, -23)),
    end: endOfMonth(now),
  };
}

export function summarizeActionableEntries(
  entries: FinanceiroEntryWithProject[],
  getVisualStatus: (entry: FinanceiroEntryWithProject, now?: Date) => FinanceiroVisualStatus,
  now = new Date(),
) {
  return entries.reduce(
    (acc, entry) => {
      const visualStatus = getVisualStatus(entry, now);
      const amount = normalizeFinanceiroAmount(entry.amount);
      const actionable = visualStatus === "overdue" || visualStatus === "upcoming";

      if (entry.type === "income" && actionable) acc.receivableNow += amount;
      if (entry.type === "expense" && actionable) acc.payableNow += amount;
      if (visualStatus === "overdue") acc.overdueCount += 1;
      if (visualStatus === "upcoming") acc.upcomingCount += 1;

      return acc;
    },
    {
      receivableNow: 0,
      payableNow: 0,
      overdueCount: 0,
      upcomingCount: 0,
    },
  );
}

export function buildExecutiveSnapshot(
  entries: FinanceiroEntryWithProject[],
  basis: FinanceiroReportingBasis,
  getVisualStatus: (entry: FinanceiroEntryWithProject, now?: Date) => FinanceiroVisualStatus,
  now = new Date(),
  periodPreset: FinanceiroPeriodPreset = "month",
  customStart?: string,
  customEnd?: string,
): FinanceiroExecutiveSnapshot {
  const { start: selectedPeriodStart, end: selectedPeriodEnd } = getRangeFromPreset(now, periodPreset, customStart, customEnd);
  const last6MonthsStart = startOfMonth(addMonths(now, -5));
  const currentMonthEnd = endOfMonth(now);
  const currentYearStart = startOfMonth(new Date(now.getFullYear(), 0, 1));

  const snapshot: FinanceiroExecutiveSnapshot = {
    operation: summarizeActionableEntries(entries, getVisualStatus, now),
    selectedPeriod: {
      preset: periodPreset,
      start: toDateKey(selectedPeriodStart),
      end: toDateKey(selectedPeriodEnd),
      isMonthView: periodPreset === "month",
      income: 0,
      expense: 0,
      profit: 0,
      planned: 0,
      breakdown: [],
    },
    fixedKpis: {
      income6m: 0,
      expense6m: 0,
      incomeYear: 0,
      expenseYear: 0,
    },
  };

  for (const entry of entries) {
    const amount = normalizeFinanceiroAmount(entry.amount);
    const datedAt = getEntryDateByBasis(entry, basis);
    const projectionDate = getProjectionDate(entry);

    if (datedAt && datedAt >= selectedPeriodStart && datedAt <= selectedPeriodEnd) {
      if (entry.type === "income") snapshot.selectedPeriod.income += amount;
      if (entry.type === "expense") snapshot.selectedPeriod.expense += amount;
      snapshot.selectedPeriod.breakdown.push({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        amount,
        competency_date: entry.competency_date,
        due_date: entry.due_date,
        contract_id: entry.financial_contract_id,
        effective_date: toDateKey(datedAt),
      });
    }

    if (datedAt && datedAt >= last6MonthsStart && datedAt <= currentMonthEnd) {
      if (entry.type === "income") snapshot.fixedKpis.income6m += amount;
      if (entry.type === "expense") snapshot.fixedKpis.expense6m += amount;
    }

    if (datedAt && datedAt >= currentYearStart && datedAt <= currentMonthEnd) {
      if (entry.type === "income") snapshot.fixedKpis.incomeYear += amount;
      if (entry.type === "expense") snapshot.fixedKpis.expenseYear += amount;
    }

    if (
      projectionDate >= selectedPeriodStart &&
      projectionDate <= selectedPeriodEnd &&
      entry.status !== "paid"
    ) {
      snapshot.selectedPeriod.planned += entry.type === "income" ? amount : -amount;
    }
  }

  snapshot.selectedPeriod.profit = snapshot.selectedPeriod.income - snapshot.selectedPeriod.expense;
  return snapshot;
}

export function buildMonthlyTrend(
  entries: FinanceiroEntryWithProject[],
  basis: FinanceiroReportingBasis,
  now = new Date(),
  preset: FinanceiroPeriodPreset = "12m",
  customStart?: string,
  customEnd?: string,
) {
  const { start, end } = getRangeFromPreset(now, preset, customStart, customEnd);
  const firstMonth = startOfMonth(start);
  const lastMonth = startOfMonth(end);
  const months =
    (lastMonth.getFullYear() - firstMonth.getFullYear()) * 12 +
    (lastMonth.getMonth() - firstMonth.getMonth()) +
    1;

  const points = Array.from({ length: months }, (_, index) => {
    const date = addMonths(firstMonth, index);
    return {
      monthKey: formatMonthKey(date),
      label: formatMonthLabel(date),
      income: 0,
      expense: 0,
      profit: 0,
    } satisfies FinanceiroMonthlyTrendPoint;
  });

  const pointMap = new Map(points.map((point) => [point.monthKey, point]));

  for (const entry of entries) {
    const date = getEntryDateByBasis(entry, basis);
    if (!date) continue;
    if (date < start || date > end) continue;
    const key = formatMonthKey(date);
    const point = pointMap.get(key);
    if (!point) continue;

    const amount = normalizeFinanceiroAmount(entry.amount);
    if (entry.type === "income") point.income += amount;
    else point.expense += amount;
    point.profit = point.income - point.expense;
  }

  return points;
}

export function buildProjectionTimeline(
  entries: FinanceiroEntryWithProject[],
  contracts: FinanceiroContractWithProject[],
  now = new Date(),
  months = 6,
) {
  const firstMonth = startOfMonth(now);
  const mergedEntries = [
    ...entries,
    ...buildMissingForecastEntries(contracts, entries, now, months),
  ];
  const points = Array.from({ length: months }, (_, index) => {
    const date = addMonths(firstMonth, index);
    return {
      monthKey: formatMonthKey(date),
      label: formatMonthLabel(date),
      income: 0,
      expense: 0,
      profit: 0,
    } satisfies FinanceiroProjectionPoint;
  });

  const pointMap = new Map(points.map((point) => [point.monthKey, point]));

  for (const entry of mergedEntries) {
    const date = getProjectionDate(entry);
    if (date < firstMonth) continue;
    const point = pointMap.get(formatMonthKey(date));
    if (!point) continue;

    const amount = normalizeFinanceiroAmount(entry.amount);
    if (entry.type === "income") point.income += amount;
    else point.expense += amount;
    point.profit = point.income - point.expense;
  }

  return points;
}

export function filterEntriesForExecutiveView(
  entries: FinanceiroEntryWithProject[],
  {
    basis,
    preset,
    now,
    customStart,
    customEnd,
    type,
    projectId,
    contractId,
    status,
    search,
    getVisualStatus,
  }: {
    basis: FinanceiroReportingBasis;
    preset: FinanceiroPeriodPreset;
    now: Date;
    customStart?: string;
    customEnd?: string;
    type: "all" | "income" | "expense";
    projectId: string;
    contractId: string;
    status: "all" | "actionable" | "pending" | "paid" | "overdue" | "upcoming";
    search: string;
    getVisualStatus: (entry: FinanceiroEntryWithProject, now?: Date) => FinanceiroVisualStatus;
  },
) {
  const { start, end } = getRangeFromPreset(now, preset, customStart, customEnd);
  const normalizedSearch = search.trim().toLowerCase();

  return entries.filter((entry) => {
    const visualStatus = getVisualStatus(entry, now);
    const effectiveDate = getEntryDateByBasis(entry, basis) ?? getProjectionDate(entry);

    if (effectiveDate < start || effectiveDate > end) return false;
    if (type !== "all" && entry.type !== type) return false;
    if (projectId !== "all" && entry.project_id !== projectId) return false;
    if (contractId !== "all" && entry.financial_contract_id !== contractId) return false;

    if (status === "actionable" && !["overdue", "upcoming"].includes(visualStatus)) return false;
    if (status !== "all" && status !== "actionable" && visualStatus !== status) return false;

    if (!normalizedSearch) return true;

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
      .toLowerCase()
      .includes(normalizedSearch);
  });
}

function isContractActiveInMonth(contract: FinanceiroContractWithProject, monthStart: Date) {
  if (contract.status !== "active") return false;

  const contractStart = startOfMonth(parseFinanceiroDate(contract.start_date));
  const contractEnd = contract.end_date ? endOfMonth(parseFinanceiroDate(contract.end_date)) : null;

  if (monthStart < contractStart) return false;
  if (contractEnd && monthStart > contractEnd) return false;
  return true;
}

function shouldGenerateEntryForMonth(contract: FinanceiroContractWithProject, monthStart: Date) {
  if (!isContractActiveInMonth(contract, monthStart)) return false;
  if (contract.recurrence === "yearly") {
    return monthStart.getMonth() === parseFinanceiroDate(contract.start_date).getMonth();
  }
  return true;
}

function buildDueDate(monthStart: Date, dueDay: number) {
  const lastDay = endOfMonth(monthStart).getDate();
  const day = Math.min(Math.max(dueDay, 1), lastDay);
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
}

export function buildMissingForecastEntries(
  contracts: FinanceiroContractWithProject[],
  entries: FinanceiroEntryWithProject[],
  now = new Date(),
  months = 24,
): FinanceiroForecastEntryInput[] {
  const existingKeys = new Set(
    entries
      .filter((entry) => entry.financial_contract_id)
      .map((entry) => {
        const competencyKey = normalizeDateKey(entry.competency_date) || normalizeDateKey(entry.due_date);
        const dueKey = normalizeDateKey(entry.due_date);
        return `${entry.financial_contract_id}:${competencyKey}:${dueKey}`;
      }),
  );

  const missing: FinanceiroForecastEntryInput[] = [];
  const currentMonth = startOfMonth(now);

  for (const contract of contracts) {
    if (contract.recurrence === "none") continue;

    for (let index = 0; index < months; index += 1) {
      const monthStart = addMonths(currentMonth, index);
      if (!shouldGenerateEntryForMonth(contract, monthStart)) continue;

      const dueDate = buildDueDate(monthStart, contract.due_day);
      const competencyDate = startOfMonth(monthStart);
      const key = `${contract.id}:${competencyDate.toISOString().slice(0, 10)}:${dueDate.toISOString().slice(0, 10)}`;

      if (existingKeys.has(key)) continue;

      missing.push({
        user_id: contract.user_id,
        project_id: contract.project_id,
        financial_contract_id: contract.id,
        type: contract.type,
        category: contract.category,
        title: contract.name,
        description: null,
        counterparty_name: contract.counterparty_name,
        amount: normalizeFinanceiroAmount(contract.amount),
        currency: contract.currency,
        status: "pending",
        due_date: dueDate.toISOString().slice(0, 10),
        paid_at: null,
        competency_date: competencyDate.toISOString().slice(0, 10),
        recurrence: contract.recurrence,
        alert_days_before: contract.alert_days_before,
        is_platform_cost: contract.is_platform_cost,
        payment_url: contract.payment_url,
        notes: contract.notes,
      });
    }
  }

  return missing;
}
