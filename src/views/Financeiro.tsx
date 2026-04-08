import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Landmark,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { financeiroApi } from "@/features/financeiro/api";
import {
  buildExecutiveSnapshot,
  buildMissingForecastEntries,
  buildMonthlyTrend,
  buildProjectionTimeline,
  filterEntriesForExecutiveView,
  summarizeActionableEntries,
  type FinanceiroPeriodPreset,
} from "@/features/financeiro/analytics";
import type {
  FinanceiroContractStatus,
  FinanceiroContractWithProject,
  FinanceiroEntryRecurrence,
  FinanceiroEntryStatus,
  FinanceiroEntryType,
  FinanceiroEntryWithProject,
  FinanceiroReportingBasis,
  FinanceiroVisualStatus,
} from "@/features/financeiro/types";
import {
  buildFinanceiroSearchText,
  describeFinanceiroAmount,
  formatEntryTypeLabel,
  formatRecurrenceLabel,
  formatVisualStatusLabel,
  getFinanceiroVisualStatus,
  sortFinanceiroEntries,
} from "@/features/financeiro/utils";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatMoney } from "@/lib/utils";
import type { FinancialContract, FinancialEntry, Project } from "@/types";

type FinanceiroProject = Pick<Project, "id" | "name" | "client" | "color">;
type ExecutiveStatusFilter = "all" | "actionable" | "pending" | "paid" | "overdue" | "upcoming";

type EntryFormState = {
  type: FinanceiroEntryType;
  projectId: string;
  contractId: string;
  category: string;
  title: string;
  description: string;
  counterpartyName: string;
  amount: string;
  currency: string;
  status: FinanceiroEntryStatus;
  dueDate: string;
  paidAt: string;
  competencyDate: string;
  recurrence: FinanceiroEntryRecurrence;
  alertDaysBefore: string;
  isPlatformCost: boolean;
  paymentUrl: string;
  notes: string;
};

type ContractFormState = {
  type: FinanceiroEntryType;
  projectId: string;
  name: string;
  counterpartyName: string;
  category: string;
  amount: string;
  currency: string;
  recurrence: FinanceiroEntryRecurrence;
  dueDay: string;
  alertDaysBefore: string;
  startDate: string;
  endDate: string;
  status: FinanceiroContractStatus;
  paymentUrl: string;
  isPlatformCost: boolean;
  notes: string;
};

const ENTRY_TYPE_OPTIONS: { label: string; value: FinanceiroEntryType }[] = [
  { label: "Entrada", value: "income" },
  { label: "Saida", value: "expense" },
];

const ENTRY_STATUS_OPTIONS: { label: string; value: FinanceiroEntryStatus }[] = [
  { label: "Pendente", value: "pending" },
  { label: "Pago", value: "paid" },
  { label: "Atrasado", value: "overdue" },
];

const CONTRACT_STATUS_OPTIONS: { label: string; value: FinanceiroContractStatus }[] = [
  { label: "Ativo", value: "active" },
  { label: "Inativo", value: "inactive" },
];

const RECURRENCE_OPTIONS: { label: string; value: FinanceiroEntryRecurrence }[] = [
  { label: "Pontual", value: "none" },
  { label: "Mensal", value: "monthly" },
  { label: "Anual", value: "yearly" },
];

const PERIOD_OPTIONS: { label: string; value: FinanceiroPeriodPreset }[] = [
  { label: "Mes atual", value: "month" },
  { label: "6 meses", value: "6m" },
  { label: "12 meses", value: "12m" },
  { label: "24 meses", value: "24m" },
  { label: "Customizado", value: "custom" },
];

const BASIS_OPTIONS: { label: string; value: FinanceiroReportingBasis }[] = [
  { label: "Competencia", value: "competence" },
  { label: "Caixa", value: "cash" },
];

const STATUS_FILTER_OPTIONS: { label: string; value: ExecutiveStatusFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Acionaveis", value: "actionable" },
  { label: "Pendentes", value: "pending" },
  { label: "Proximos", value: "upcoming" },
  { label: "Vencidos", value: "overdue" },
  { label: "Pagos", value: "paid" },
];

const PROJECTION_OPTIONS = [6, 12, 24] as const;

const chartConfig = {
  income: { label: "Receita", color: "#2DD4BF" },
  expense: { label: "Despesa", color: "#F59E0B" },
  profit: { label: "Lucro", color: "#38BDF8" },
};

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function defaultEntryFormState(): EntryFormState {
  return {
    type: "expense",
    projectId: "none",
    contractId: "none",
    category: "",
    title: "",
    description: "",
    counterpartyName: "",
    amount: "",
    currency: "BRL",
    status: "pending",
    dueDate: todayDateInput(),
    paidAt: "",
    competencyDate: "",
    recurrence: "none",
    alertDaysBefore: "7",
    isPlatformCost: false,
    paymentUrl: "",
    notes: "",
  };
}

function defaultContractFormState(): ContractFormState {
  return {
    type: "expense",
    projectId: "none",
    name: "",
    counterpartyName: "",
    category: "",
    amount: "",
    currency: "BRL",
    recurrence: "monthly",
    dueDay: "1",
    alertDaysBefore: "7",
    startDate: todayDateInput(),
    endDate: "",
    status: "active",
    paymentUrl: "",
    isPlatformCost: false,
    notes: "",
  };
}

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toDateTimeLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalInput(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function parseAmount(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatusForSave(form: EntryFormState) {
  if (form.status === "paid" || form.paidAt) return "paid";
  if (form.status === "overdue") return "overdue";

  const dueDate = new Date(form.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueAt = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return dueAt < today ? "overdue" : "pending";
}

function mapContractsWithProjects(contracts: FinancialContract[], projects: FinanceiroProject[]): FinanceiroContractWithProject[] {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  return contracts.map((contract) => ({
    ...contract,
    project: contract.project_id ? projectMap.get(contract.project_id) || null : null,
  }));
}

function mapEntriesWithRelations(
  entries: FinancialEntry[],
  projects: FinanceiroProject[],
  contracts: FinanceiroContractWithProject[],
): FinanceiroEntryWithProject[] {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const contractMap = new Map(contracts.map((contract) => [contract.id, contract]));

  return entries.map((entry) => {
    const contract = entry.financial_contract_id ? contractMap.get(entry.financial_contract_id) || null : null;
    return {
      ...entry,
      amount: typeof entry.amount === "number" ? entry.amount : parseAmount(String(entry.amount)),
      project: entry.project_id ? projectMap.get(entry.project_id) || null : null,
      contract: contract
        ? {
            id: contract.id,
            name: contract.name,
            status: contract.status,
            payment_url: contract.payment_url,
          }
        : null,
    };
  });
}

function statusClassName(status: FinanceiroVisualStatus) {
  switch (status) {
    case "overdue":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    case "upcoming":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "paid":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-border bg-background/40 text-muted-foreground";
  }
}

function buildEntryPayload(form: EntryFormState, userId: string) {
  const savedStatus = normalizeStatusForSave(form);
  const paidAt = savedStatus === "paid" ? fromDateTimeLocalInput(form.paidAt) || new Date().toISOString() : null;

  return {
    user_id: userId,
    project_id: form.projectId === "none" ? null : form.projectId,
    financial_contract_id: form.contractId === "none" ? null : form.contractId,
    type: form.type,
    category: form.category.trim(),
    title: form.title.trim(),
    description: form.description.trim() || null,
    counterparty_name: form.counterpartyName.trim(),
    amount: parseAmount(form.amount),
    currency: form.currency.trim() || "BRL",
    status: savedStatus,
    due_date: form.dueDate,
    paid_at: paidAt,
    competency_date: form.competencyDate || null,
    recurrence: form.recurrence,
    alert_days_before: parseInteger(form.alertDaysBefore, 7),
    is_platform_cost: form.isPlatformCost,
    payment_url: form.paymentUrl.trim() || null,
    notes: form.notes.trim() || null,
  };
}

function buildContractPayload(form: ContractFormState, userId: string) {
  return {
    user_id: userId,
    project_id: form.projectId === "none" ? null : form.projectId,
    type: form.type,
    name: form.name.trim(),
    counterparty_name: form.counterpartyName.trim(),
    category: form.category.trim(),
    amount: parseAmount(form.amount),
    currency: form.currency.trim() || "BRL",
    recurrence: form.recurrence,
    due_day: parseInteger(form.dueDay, 1),
    alert_days_before: parseInteger(form.alertDaysBefore, 7),
    start_date: form.startDate,
    end_date: form.endDate || null,
    status: form.status,
    payment_url: form.paymentUrl.trim() || null,
    is_platform_cost: form.isPlatformCost,
    notes: form.notes.trim() || null,
  };
}

function StatsCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const iconClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "danger"
          ? "text-rose-300"
          : "text-primary";

  return (
    <Card className="rounded-2xl border-border bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <Icon className={cn("h-4 w-4", iconClass)} />
          <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.18em] break-words">{label}</p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="break-words text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function MoneyDelta({ value }: { value: number }) {
  return <span className={cn("font-semibold", value >= 0 ? "text-emerald-300" : "text-rose-300")}>{formatMoney(value)}</span>;
}

function groupProjectionByYear(points: Array<{ monthKey: string; label: string; income: number; expense: number; profit: number }>) {
  const grouped = new Map<string, { monthKey: string; label: string; income: number; expense: number; profit: number }>();

  for (const point of points) {
    const year = point.monthKey.slice(0, 4);
    const current = grouped.get(year) || {
      monthKey: year,
      label: year,
      income: 0,
      expense: 0,
      profit: 0,
    };

    current.income += point.income;
    current.expense += point.expense;
    current.profit += point.profit;
    grouped.set(year, current);
  }

  return Array.from(grouped.values());
}

function matchesExecutiveStatusFilter(
  entry: FinanceiroEntryWithProject,
  statusFilter: ExecutiveStatusFilter,
  now: Date,
) {
  const visualStatus = getFinanceiroVisualStatus(entry, now);

  if (statusFilter === "all") return true;
  if (statusFilter === "actionable") return visualStatus === "overdue" || visualStatus === "upcoming";
  return visualStatus === statusFilter;
}

export default function FinanceiroPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [syncingForecast, setSyncingForecast] = useState(false);

  const [projects, setProjects] = useState<FinanceiroProject[]>([]);
  const [entries, setEntries] = useState<FinanceiroEntryWithProject[]>([]);
  const [contracts, setContracts] = useState<FinanceiroContractWithProject[]>([]);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceiroEntryWithProject | null>(null);
  const [editingContract, setEditingContract] = useState<FinanceiroContractWithProject | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState>(defaultEntryFormState);
  const [contractForm, setContractForm] = useState<ContractFormState>(defaultContractFormState);

  const [activeTab, setActiveTab] = useState("executivo");
  const [basis, setBasis] = useState<FinanceiroReportingBasis>("competence");
  const [periodPreset, setPeriodPreset] = useState<FinanceiroPeriodPreset>("month");
  const [projectionMonths, setProjectionMonths] = useState<(typeof PROJECTION_OPTIONS)[number]>(6);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ExecutiveStatusFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");

  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (searchParams?.get("compose") === "entry") {
      setActiveTab("lancamentos");
      setEntryDialogOpen(true);
    }
  }, [searchParams]);

  async function loadData(allowForecastSync = true) {
    if (!user) return;
    setLoading(true);

    const [projectsRes, contractsRes, entriesRes] = await Promise.all([
      financeiroApi.db.from("projects").select("id, name, client, color").order("name"),
      financeiroApi.db.from("financial_contracts").select("*").order("name"),
      financeiroApi.db.from("financial_entries").select("*").order("due_date", { ascending: true }),
    ]);

    if (projectsRes.error || contractsRes.error || entriesRes.error) {
      toast.error("Nao foi possivel carregar o financeiro.");
      setLoading(false);
      return;
    }

    const loadedProjects = (projectsRes.data || []) as FinanceiroProject[];
    const loadedContracts = mapContractsWithProjects((contractsRes.data || []) as FinancialContract[], loadedProjects);
    const loadedEntries = mapEntriesWithRelations((entriesRes.data || []) as FinancialEntry[], loadedProjects, loadedContracts);

    if (allowForecastSync) {
      const missingForecastEntries = buildMissingForecastEntries(loadedContracts, loadedEntries, now, 24);

      if (missingForecastEntries.length > 0) {
        setSyncingForecast(true);
        const insertRes = await financeiroApi.db.from("financial_entries").insert(missingForecastEntries);
        setSyncingForecast(false);

        if (insertRes.error) {
          toast.error("Falha ao materializar a previsao dos contratos.");
        } else {
          toast.success(`${missingForecastEntries.length} parcelas futuras geradas a partir dos contratos.`);
          await loadData(false);
          return;
        }
      }
    }

    setProjects(loadedProjects);
    setContracts(loadedContracts);
    setEntries(loadedEntries);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [user]);

  const baseScopedEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "all" && entry.type !== typeFilter) return false;
      if (projectFilter !== "all" && entry.project_id !== projectFilter) return false;
      if (contractFilter !== "all" && entry.financial_contract_id !== contractFilter) return false;
      if (!normalizedSearch) return true;
      return buildFinanceiroSearchText(entry).includes(normalizedSearch);
    });
  }, [contractFilter, entries, projectFilter, search, typeFilter]);

  const statusScopedEntries = useMemo(
    () => baseScopedEntries.filter((entry) => matchesExecutiveStatusFilter(entry, statusFilter, now)),
    [baseScopedEntries, now, statusFilter],
  );

  const visibleEntries = useMemo(
    () =>
      filterEntriesForExecutiveView(statusScopedEntries, {
        basis,
        preset: periodPreset,
        now,
        customStart,
        customEnd,
        type: "all",
        projectId: "all",
        contractId: "all",
        status: "all",
        search: "",
        getVisualStatus: getFinanceiroVisualStatus,
      }),
    [basis, customEnd, customStart, now, periodPreset, statusScopedEntries],
  );

  const actionableSummary = useMemo(
    () => summarizeActionableEntries(baseScopedEntries, getFinanceiroVisualStatus, now),
    [baseScopedEntries, now],
  );

  const executiveSnapshot = useMemo(() => {
    const snapshot = buildExecutiveSnapshot(
      statusScopedEntries,
      basis,
      getFinanceiroVisualStatus,
      now,
      periodPreset,
      customStart,
      customEnd,
    );
    return {
      ...snapshot,
      operation: actionableSummary,
    };
  }, [actionableSummary, basis, customEnd, customStart, now, periodPreset, statusScopedEntries]);

  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(statusScopedEntries, basis, now, periodPreset, customStart, customEnd),
    [basis, customEnd, customStart, now, periodPreset, statusScopedEntries],
  );

  const periodCardCopy = useMemo(() => {
    if (periodPreset === "month") {
      return {
        incomeLabel: "Receita Do Mes",
        expenseLabel: "Despesa Do Mes",
        profitLabel: "Lucro Do Mes",
        plannedLabel: "Previsto Do Mes",
        incomeHelper: `Realizado por ${basis === "cash" ? "caixa" : "competencia"} no mes corrente.`,
        expenseHelper: `Saidas registradas por ${basis === "cash" ? "caixa" : "competencia"} no mes corrente.`,
        profitHelper: "Receita menos despesa no mes atual.",
        plannedHelper: "Saldo projetado do mes com pendencias ainda nao liquidadas.",
      };
    }

    return {
      incomeLabel: "Receita Do Periodo",
      expenseLabel: "Despesa Do Periodo",
      profitLabel: "Lucro Do Periodo",
      plannedLabel: "Previsto Do Periodo",
      incomeHelper: `Realizado por ${basis === "cash" ? "caixa" : "competencia"} no recorte selecionado.`,
      expenseHelper: `Saidas registradas por ${basis === "cash" ? "caixa" : "competencia"} no recorte selecionado.`,
      profitHelper: "Receita menos despesa no periodo filtrado.",
      plannedHelper: "Saldo projetado dentro do periodo filtrado com pendencias ainda nao liquidadas.",
    };
  }, [basis, periodPreset]);

  const trendDescription = useMemo(() => {
    if (periodPreset === "month") return "Serie do mes atual sem incluir meses fora do recorte.";
    if (periodPreset === "custom") return "Serie mensal limitada ao intervalo customizado selecionado.";
    return `Serie mensal alinhada ao recorte de ${periodPreset.replace("m", " meses")}.`;
  }, [periodPreset]);
  const projectionDescription = useMemo(() => {
    if (projectionMonths <= 6) {
      return "Horizonte mensal de 6 meses com contratos ativos e lancamentos futuros.";
    }

    if (projectionMonths === 12) {
      return "Horizonte de 12 meses consolidado por ano para evitar repeticao mensal.";
    }

    return "Horizonte de 24 meses consolidado por ano para leitura executiva.";
  }, [projectionMonths]);

  const operationalQueue = useMemo(
    () =>
      sortFinanceiroEntries(
        baseScopedEntries.filter((entry) => {
          const visualStatus = getFinanceiroVisualStatus(entry, now);
          return visualStatus === "overdue" || visualStatus === "upcoming";
        }),
        now,
      ),
    [baseScopedEntries, now],
  );

  const visibleContracts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (typeFilter !== "all" && contract.type !== typeFilter) return false;
      if (projectFilter !== "all" && contract.project_id !== projectFilter) return false;
      if (contractFilter !== "all" && contract.id !== contractFilter) return false;
      if (!normalizedSearch) return true;
      return [contract.name, contract.category, contract.counterparty_name, contract.project?.name, contract.project?.client]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [contractFilter, contracts, projectFilter, search, typeFilter]);

  const projectionTimeline = useMemo(
    () => buildProjectionTimeline(baseScopedEntries, visibleContracts, now, projectionMonths),
    [baseScopedEntries, now, projectionMonths, visibleContracts],
  );
  const projectionDisplayPoints = useMemo(
    () => (projectionMonths <= 6 ? projectionTimeline : groupProjectionByYear(projectionTimeline)),
    [projectionMonths, projectionTimeline],
  );

  function openCreateEntryDialog() {
    setEditingEntry(null);
    setEntryForm(defaultEntryFormState());
    setEntryDialogOpen(true);
  }

  function openEditEntryDialog(entry: FinanceiroEntryWithProject) {
    setEditingEntry(entry);
    setEntryForm({
      type: entry.type,
      projectId: entry.project_id || "none",
      contractId: entry.financial_contract_id || "none",
      category: entry.category,
      title: entry.title,
      description: entry.description || "",
      counterpartyName: entry.counterparty_name,
      amount: String(entry.amount),
      currency: entry.currency,
      status: entry.status,
      dueDate: toDateInput(entry.due_date),
      paidAt: toDateTimeLocalInput(entry.paid_at),
      competencyDate: toDateInput(entry.competency_date),
      recurrence: entry.recurrence,
      alertDaysBefore: String(entry.alert_days_before),
      isPlatformCost: entry.is_platform_cost,
      paymentUrl: entry.payment_url || "",
      notes: entry.notes || "",
    });
    setEntryDialogOpen(true);
  }

  function openCreateContractDialog() {
    setEditingContract(null);
    setContractForm(defaultContractFormState());
    setContractDialogOpen(true);
  }

  function openEditContractDialog(contract: FinanceiroContractWithProject) {
    setEditingContract(contract);
    setContractForm({
      type: contract.type,
      projectId: contract.project_id || "none",
      name: contract.name,
      counterpartyName: contract.counterparty_name,
      category: contract.category,
      amount: String(contract.amount),
      currency: contract.currency,
      recurrence: contract.recurrence,
      dueDay: String(contract.due_day),
      alertDaysBefore: String(contract.alert_days_before),
      startDate: toDateInput(contract.start_date),
      endDate: toDateInput(contract.end_date),
      status: contract.status,
      paymentUrl: contract.payment_url || "",
      isPlatformCost: contract.is_platform_cost,
      notes: contract.notes || "",
    });
    setContractDialogOpen(true);
  }

  async function handleSaveEntry() {
    if (!user) return;
    if (!entryForm.title.trim() || !entryForm.category.trim() || !entryForm.counterpartyName.trim()) {
      toast.error("Preencha titulo, categoria e contraparte.");
      return;
    }

    setSavingEntry(true);
    const payload = buildEntryPayload(entryForm, user.id);
    const query = editingEntry
      ? financeiroApi.db.from("financial_entries").update(payload).eq("id", editingEntry.id).select().single()
      : financeiroApi.db.from("financial_entries").insert(payload).select().single();

    const result = await query;
    setSavingEntry(false);

    if (result.error) {
      toast.error("Nao foi possivel salvar o lancamento.");
      return;
    }

    toast.success(editingEntry ? "Lancamento atualizado." : "Lancamento criado.");
    setEntryDialogOpen(false);
    setEditingEntry(null);
    setEntryForm(defaultEntryFormState());
    await loadData(false);
  }

  async function handleDeleteEntry(entryId: string) {
    const confirmed = window.confirm("Excluir este lancamento?");
    if (!confirmed) return;

    const result = await financeiroApi.db.from("financial_entries").delete().eq("id", entryId);
    if (result.error) {
      toast.error("Nao foi possivel excluir o lancamento.");
      return;
    }

    toast.success("Lancamento excluido.");
    await loadData(false);
  }

  async function handleSaveContract() {
    if (!user) return;
    if (!contractForm.name.trim() || !contractForm.category.trim() || !contractForm.counterpartyName.trim()) {
      toast.error("Preencha nome, categoria e contraparte.");
      return;
    }

    setSavingContract(true);
    const payload = buildContractPayload(contractForm, user.id);
    const query = editingContract
      ? financeiroApi.db.from("financial_contracts").update(payload).eq("id", editingContract.id).select().single()
      : financeiroApi.db.from("financial_contracts").insert(payload).select().single();

    const result = await query;
    setSavingContract(false);

    if (result.error) {
      toast.error("Nao foi possivel salvar o contrato.");
      return;
    }

    toast.success(editingContract ? "Contrato atualizado." : "Contrato criado.");
    setContractDialogOpen(false);
    setEditingContract(null);
    setContractForm(defaultContractFormState());
    await loadData();
  }

  async function handleToggleContractStatus(contract: FinanceiroContractWithProject, nextStatus: FinanceiroContractStatus) {
    const result = await financeiroApi.db
      .from("financial_contracts")
      .update({
        status: nextStatus,
        end_date: nextStatus === "inactive" ? contract.end_date || todayDateInput() : null,
      })
      .eq("id", contract.id);

    if (result.error) {
      toast.error("Nao foi possivel atualizar o status do contrato.");
      return;
    }

    toast.success(nextStatus === "active" ? "Contrato reativado." : "Contrato pausado.");
    await loadData(false);
  }

  async function handleCloseContract(contract: FinanceiroContractWithProject) {
    const confirmed = window.confirm("Encerrar este contrato e parar novas parcelas futuras?");
    if (!confirmed) return;

    const result = await financeiroApi.db
      .from("financial_contracts")
      .update({
        status: "inactive",
        end_date: todayDateInput(),
      })
      .eq("id", contract.id);

    if (result.error) {
      toast.error("Nao foi possivel encerrar o contrato.");
      return;
    }

    toast.success("Contrato encerrado.");
    await loadData(false);
  }

  async function handleResyncForecast() {
    await loadData(true);
  }

  if (!user) {
    return <LoadingState message="Autenticando..." />;
  }

  if (loading) {
    return <LoadingState message="Carregando financeiro..." />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Financeiro"
        description="Operacao, gestao e projecao no mesmo painel, com contratos recorrentes como fonte oficial de previsao."
        actions={
          <div className="grid w-full gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleResyncForecast} disabled={syncingForecast}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span className="sm:hidden">{syncingForecast ? "Sincronizando..." : "Previsao"}</span>
              <span className="hidden sm:inline">{syncingForecast ? "Sincronizando previsao..." : "Reprocessar previsao"}</span>
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={openCreateContractDialog}>
              <Landmark className="mr-2 h-4 w-4" />
              <span className="sm:hidden">Contrato</span>
              <span className="hidden sm:inline">Novo contrato</span>
            </Button>
            <Button className="w-full sm:w-auto" onClick={openCreateEntryDialog}>
              <Plus className="mr-2 h-4 w-4" />
              <span className="sm:hidden">Lancamento</span>
              <span className="hidden sm:inline">Novo lancamento</span>
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-border bg-card/95">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Painel executivo</CardTitle>
              <CardDescription>Filtros globais para operacao, historico e projecao.</CardDescription>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por titulo, contraparte, categoria, cliente ou projeto"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2">
            <Label>Criterio</Label>
            <Select value={basis} onValueChange={(value) => setBasis(value as FinanceiroReportingBasis)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BASIS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Periodo</Label>
            <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as FinanceiroPeriodPreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | "income" | "expense")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ENTRY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contrato</Label>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>{contract.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ExecutiveStatusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {periodPreset === "custom" ? (
            <>
              <div className="space-y-2 xl:col-span-1">
                <Label>Data inicial</Label>
                <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-1">
                <Label>Data final</Label>
                <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="executivo">Executivo</TabsTrigger>
          <TabsTrigger value="lancamentos">Lancamentos</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="executivo" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard icon={ArrowUpCircle} label="A Receber Agora" value={formatMoney(executiveSnapshot.operation.receivableNow)} helper="Receitas vencidas ou ja dentro da janela de alerta." tone="success" />
            <StatsCard icon={ArrowDownCircle} label="A Pagar Agora" value={formatMoney(executiveSnapshot.operation.payableNow)} helper="Despesas vencidas ou dentro da janela operacional." tone="warning" />
            <StatsCard icon={AlertTriangle} label="Vencidos" value={String(executiveSnapshot.operation.overdueCount).padStart(2, "0")} helper="Lancamentos fora do prazo e exigindo acao imediata." tone="danger" />
            <StatsCard icon={CalendarClock} label="Proximos" value={String(executiveSnapshot.operation.upcomingCount).padStart(2, "0")} helper="Lancamentos prestes a vencer dentro da janela de alerta." tone="warning" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard icon={Wallet} label={periodCardCopy.incomeLabel} value={formatMoney(executiveSnapshot.selectedPeriod.income)} helper={periodCardCopy.incomeHelper} tone="success" />
            <StatsCard icon={CreditCard} label={periodCardCopy.expenseLabel} value={formatMoney(executiveSnapshot.selectedPeriod.expense)} helper={periodCardCopy.expenseHelper} tone="warning" />
            <StatsCard icon={BarChart3} label={periodCardCopy.profitLabel} value={formatMoney(executiveSnapshot.selectedPeriod.profit)} helper={periodCardCopy.profitHelper} tone={executiveSnapshot.selectedPeriod.profit >= 0 ? "success" : "danger"} />
            <StatsCard icon={CalendarClock} label={periodCardCopy.plannedLabel} value={formatMoney(executiveSnapshot.selectedPeriod.planned)} helper={periodCardCopy.plannedHelper} tone={executiveSnapshot.selectedPeriod.planned >= 0 ? "success" : "warning"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Faturamento 6 meses</CardTitle>
                <CardDescription>KPI estrutural fixo, independente do filtro de periodo.</CardDescription>
              </CardHeader>
              <CardContent><MoneyDelta value={executiveSnapshot.fixedKpis.income6m} /></CardContent>
            </Card>
            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Despesas 6 meses</CardTitle>
                <CardDescription>KPI estrutural fixo, independente do filtro de periodo.</CardDescription>
              </CardHeader>
              <CardContent><MoneyDelta value={-executiveSnapshot.fixedKpis.expense6m} /></CardContent>
            </Card>
            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Faturamento no ano</CardTitle>
                <CardDescription>KPI estrutural fixo, independente do filtro de periodo.</CardDescription>
              </CardHeader>
              <CardContent><MoneyDelta value={executiveSnapshot.fixedKpis.incomeYear} /></CardContent>
            </Card>
            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Despesas no ano</CardTitle>
                <CardDescription>KPI estrutural fixo, independente do filtro de periodo.</CardDescription>
              </CardHeader>
              <CardContent><MoneyDelta value={-executiveSnapshot.fixedKpis.expenseYear} /></CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader>
                <CardTitle>Evolucao mensal</CardTitle>
                <CardDescription>{trendDescription}</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-4 sm:px-6">
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start sm:justify-center" />} />
                    <Bar dataKey="income" fill="var(--color-income)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" fill="var(--color-expense)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" fill="var(--color-profit)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Projecao futura</CardTitle>
                  <CardDescription>{projectionDescription}</CardDescription>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
                  {PROJECTION_OPTIONS.map((months) => (
                    <Button
                      key={months}
                      className="w-full sm:w-auto"
                      variant={projectionMonths === months ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProjectionMonths(months)}
                    >
                      {months}m
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {projectionDisplayPoints.map((point) => (
                  <div key={point.monthKey} className="rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{point.label}</p>
                        <p className="break-words text-xs text-muted-foreground">Receita {formatMoney(point.income)} - Despesa {formatMoney(point.expense)}</p>
                      </div>
                      <MoneyDelta value={point.profit} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Fila operacional</CardTitle>
              <CardDescription>Itens que exigem acao agora: vencidos ou dentro da janela de alerta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {operationalQueue.length ? (
                operationalQueue.map((entry) => {
                  const visualStatus = getFinanceiroVisualStatus(entry, now);
                  return (
                    <div key={entry.id} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusClassName(visualStatus)}>{formatVisualStatusLabel(visualStatus)}</Badge>
                            <Badge variant="outline">{formatEntryTypeLabel(entry.type)}</Badge>
                            {entry.contract ? <Badge variant="outline">Contrato</Badge> : null}
                            {entry.is_platform_cost ? <Badge variant="outline">Plataforma</Badge> : null}
                          </div>
                          <div>
                            <p className="break-words text-lg font-semibold text-foreground">{entry.title}</p>
                            <p className="break-words text-sm text-muted-foreground">{entry.project?.name || "Sem projeto"} - {entry.counterparty_name} - {entry.category}</p>
                          </div>
                          <p className="text-sm text-foreground">{describeFinanceiroAmount(entry.type, entry.amount)}</p>
                        </div>
                        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                          <Badge variant="outline">Vencimento {new Date(entry.due_date).toLocaleDateString("pt-BR")}</Badge>
                          <Badge variant="outline">{formatRecurrenceLabel(entry.recurrence)}</Badge>
                          {entry.payment_url ? (
                            <Button asChild className="w-full sm:w-auto" variant="outline" size="sm">
                              <a href={entry.payment_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir pagamento
                              </a>
                            </Button>
                          ) : null}
                          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => openEditEntryDialog(entry)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState icon={CheckCircle2} title="Nenhuma acao operacional agora" description="Nao existem lancamentos vencidos ou dentro da janela de alerta com os filtros atuais." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lancamentos" className="space-y-6">
          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Lancamentos</CardTitle>
              <CardDescription>Historico realizado e previsto materializado, com vinculo opcional a contrato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortFinanceiroEntries(visibleEntries, now).length ? (
                sortFinanceiroEntries(visibleEntries, now).map((entry) => {
                  const visualStatus = getFinanceiroVisualStatus(entry, now);
                  return (
                    <div key={entry.id} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusClassName(visualStatus)}>{formatVisualStatusLabel(visualStatus)}</Badge>
                            <Badge variant="outline">{formatEntryTypeLabel(entry.type)}</Badge>
                            <Badge variant="outline">{formatRecurrenceLabel(entry.recurrence)}</Badge>
                            {entry.contract ? <Badge variant="outline">{entry.contract.name}</Badge> : <Badge variant="outline">Avulso</Badge>}
                          </div>
                          <div>
                            <p className="break-words text-lg font-semibold text-foreground">{entry.title}</p>
                            <p className="break-words text-sm text-muted-foreground">{entry.project?.name || "Sem projeto"} - {entry.counterparty_name} - {entry.category}</p>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span>{describeFinanceiroAmount(entry.type, entry.amount)}</span>
                            <span>Competencia {entry.competency_date ? new Date(entry.competency_date).toLocaleDateString("pt-BR") : "nao definida"}</span>
                            <span>Vencimento {new Date(entry.due_date).toLocaleDateString("pt-BR")}</span>
                            <span>Base {entry.paid_at ? "realizado" : "previsto"}</span>
                          </div>
                          {entry.notes ? <p className="break-words text-sm text-muted-foreground">{entry.notes}</p> : null}
                        </div>
                        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                          {entry.payment_url ? (
                            <Button asChild className="w-full sm:w-auto" variant="outline" size="sm">
                              <a href={entry.payment_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir pagamento
                              </a>
                            </Button>
                          ) : null}
                          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => openEditEntryDialog(entry)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void handleDeleteEntry(entry.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState icon={Wallet} title="Nenhum lancamento encontrado" description="Ajuste os filtros ou crie um novo lancamento manual." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contratos" className="space-y-6">
          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Contratos recorrentes</CardTitle>
              <CardDescription>Fonte estrutural da previsao. Pause, encerre ou edite sem perder o historico ja gerado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleContracts.length ? (
                visibleContracts.map((contract) => (
                  <div key={contract.id} className="rounded-2xl border border-border/80 bg-background/40 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={contract.status === "active" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-border bg-background/40 text-muted-foreground"}>
                            {contract.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline">{formatEntryTypeLabel(contract.type)}</Badge>
                          <Badge variant="outline">{formatRecurrenceLabel(contract.recurrence)}</Badge>
                          {contract.is_platform_cost ? <Badge variant="outline">Plataforma</Badge> : null}
                        </div>
                        <div>
                          <p className="break-words text-lg font-semibold text-foreground">{contract.name}</p>
                          <p className="break-words text-sm text-muted-foreground">{contract.project?.name || "Sem projeto"} - {contract.counterparty_name} - {contract.category}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>{describeFinanceiroAmount(contract.type, contract.amount)}</span>
                          <span>Dia {contract.due_day}</span>
                          <span>Alerta {contract.alert_days_before} dias</span>
                          <span>Inicio {new Date(contract.start_date).toLocaleDateString("pt-BR")}</span>
                          <span>Fim {contract.end_date ? new Date(contract.end_date).toLocaleDateString("pt-BR") : "em aberto"}</span>
                        </div>
                        {contract.notes ? <p className="break-words text-sm text-muted-foreground">{contract.notes}</p> : null}
                      </div>
                      <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                        {contract.payment_url ? (
                          <Button asChild className="w-full sm:w-auto" variant="outline" size="sm">
                            <a href={contract.payment_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir pagamento
                            </a>
                          </Button>
                        ) : null}
                        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => openEditContractDialog(contract)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void handleToggleContractStatus(contract, contract.status === "active" ? "inactive" : "active")}>
                          {contract.status === "active" ? "Pausar" : "Ativar"}
                        </Button>
                        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void handleCloseContract(contract)}>
                          Encerrar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={Landmark} title="Nenhum contrato encontrado" description="Crie contratos recorrentes para que a previsao futura seja confiavel." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl px-4 sm:max-w-3xl sm:px-6">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Editar lancamento" : "Novo lancamento"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={entryForm.type} onValueChange={(value) => setEntryForm((current) => ({ ...current, type: value as FinanceiroEntryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTRY_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={entryForm.status} onValueChange={(value) => setEntryForm((current) => ({ ...current, status: value as FinanceiroEntryStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTRY_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={entryForm.projectId} onValueChange={(value) => setEntryForm((current) => ({ ...current, projectId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={entryForm.contractId} onValueChange={(value) => setEntryForm((current) => ({ ...current, contractId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem contrato</SelectItem>
                  {contracts.map((contract) => <SelectItem key={contract.id} value={contract.id}>{contract.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Titulo</Label><Input value={entryForm.title} onChange={(event) => setEntryForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={entryForm.category} onChange={(event) => setEntryForm((current) => ({ ...current, category: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Contraparte</Label><Input value={entryForm.counterpartyName} onChange={(event) => setEntryForm((current) => ({ ...current, counterpartyName: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Valor</Label><Input value={entryForm.amount} onChange={(event) => setEntryForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Moeda</Label><Input value={entryForm.currency} onChange={(event) => setEntryForm((current) => ({ ...current, currency: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={entryForm.dueDate} onChange={(event) => setEntryForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Competencia</Label><Input type="date" value={entryForm.competencyDate} onChange={(event) => setEntryForm((current) => ({ ...current, competencyDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Pago em</Label><Input type="datetime-local" value={entryForm.paidAt} onChange={(event) => setEntryForm((current) => ({ ...current, paidAt: event.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Recorrencia</Label>
              <Select value={entryForm.recurrence} onValueChange={(value) => setEntryForm((current) => ({ ...current, recurrence: value as FinanceiroEntryRecurrence }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECURRENCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Dias de alerta</Label><Input type="number" min="0" value={entryForm.alertDaysBefore} onChange={(event) => setEntryForm((current) => ({ ...current, alertDaysBefore: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Link de pagamento</Label><Input placeholder="https://..." value={entryForm.paymentUrl} onChange={(event) => setEntryForm((current) => ({ ...current, paymentUrl: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Descricao</Label><Textarea value={entryForm.description} onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Observacoes</Label><Textarea value={entryForm.notes} onChange={(event) => setEntryForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <div className="flex items-center gap-3 md:col-span-2"><Checkbox checked={entryForm.isPlatformCost} onCheckedChange={(checked) => setEntryForm((current) => ({ ...current, isPlatformCost: checked === true }))} /><Label>Custo de plataforma</Label></div>
            <div className="grid gap-2 md:col-span-2 md:flex md:justify-end"><Button className="w-full md:w-auto" variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancelar</Button><Button className="w-full md:w-auto" onClick={() => void handleSaveEntry()} disabled={savingEntry}>{savingEntry ? "Salvando..." : editingEntry ? "Atualizar lancamento" : "Criar lancamento"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl px-4 sm:max-w-3xl sm:px-6">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Editar contrato" : "Novo contrato"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={contractForm.type} onValueChange={(value) => setContractForm((current) => ({ ...current, type: value as FinanceiroEntryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENTRY_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={contractForm.status} onValueChange={(value) => setContractForm((current) => ({ ...current, status: value as FinanceiroContractStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={contractForm.projectId} onValueChange={(value) => setContractForm((current) => ({ ...current, projectId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recorrencia</Label>
              <Select value={contractForm.recurrence} onValueChange={(value) => setContractForm((current) => ({ ...current, recurrence: value as FinanceiroEntryRecurrence }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECURRENCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Nome do contrato</Label><Input value={contractForm.name} onChange={(event) => setContractForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={contractForm.category} onChange={(event) => setContractForm((current) => ({ ...current, category: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Contraparte</Label><Input value={contractForm.counterpartyName} onChange={(event) => setContractForm((current) => ({ ...current, counterpartyName: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Valor padrao</Label><Input value={contractForm.amount} onChange={(event) => setContractForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Moeda</Label><Input value={contractForm.currency} onChange={(event) => setContractForm((current) => ({ ...current, currency: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Dia do vencimento</Label><Input type="number" min="1" max="31" value={contractForm.dueDay} onChange={(event) => setContractForm((current) => ({ ...current, dueDay: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Dias de alerta</Label><Input type="number" min="0" value={contractForm.alertDaysBefore} onChange={(event) => setContractForm((current) => ({ ...current, alertDaysBefore: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Inicio</Label><Input type="date" value={contractForm.startDate} onChange={(event) => setContractForm((current) => ({ ...current, startDate: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={contractForm.endDate} onChange={(event) => setContractForm((current) => ({ ...current, endDate: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Link de pagamento</Label><Input placeholder="https://..." value={contractForm.paymentUrl} onChange={(event) => setContractForm((current) => ({ ...current, paymentUrl: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Observacoes</Label><Textarea value={contractForm.notes} onChange={(event) => setContractForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <div className="flex items-center gap-3 md:col-span-2"><Checkbox checked={contractForm.isPlatformCost} onCheckedChange={(checked) => setContractForm((current) => ({ ...current, isPlatformCost: checked === true }))} /><Label>Custo de plataforma</Label></div>
            <div className="grid gap-2 md:col-span-2 md:flex md:justify-end"><Button className="w-full md:w-auto" variant="outline" onClick={() => setContractDialogOpen(false)}>Cancelar</Button><Button className="w-full md:w-auto" onClick={() => void handleSaveContract()} disabled={savingContract}>{savingContract ? "Salvando..." : editingContract ? "Atualizar contrato" : "Criar contrato"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
