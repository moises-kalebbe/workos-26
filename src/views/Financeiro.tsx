import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { financeiroApi } from "@/features/financeiro/api";
import { useFinanceiroFeature } from "@/features/financeiro/hooks";
import type {
  FinanceiroEntryRecurrence,
  FinanceiroEntryStatus,
  FinanceiroEntryType,
  FinanceiroEntryWithProject,
  FinanceiroFilter,
  FinanceiroVisualStatus,
} from "@/features/financeiro/types";
import {
  describeFinanceiroAmount,
  formatEntryTypeLabel,
  formatRecurrenceLabel,
  formatVisualStatusLabel,
  getFinanceiroVisualStatus,
} from "@/features/financeiro/utils";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatMoney } from "@/lib/utils";
import type { FinancialEntry, Project } from "@/types";

type FinanceiroProject = Pick<Project, "id" | "name" | "client" | "color">;

type EntryFormState = {
  type: FinanceiroEntryType;
  projectId: string;
  category: string;
  title: string;
  description: string;
  counterpartyName: string;
  amount: string;
  status: FinanceiroEntryStatus;
  dueDate: string;
  paidAt: string;
  competencyDate: string;
  recurrence: FinanceiroEntryRecurrence;
  alertDaysBefore: string;
  isPlatformCost: boolean;
  notes: string;
};

const FILTER_OPTIONS: { label: string; value: FinanceiroFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Entradas", value: "income" },
  { label: "Saidas", value: "expense" },
  { label: "A vencer", value: "upcoming" },
  { label: "Vencidos", value: "overdue" },
  { label: "Pagos", value: "paid" },
  { label: "Plataformas", value: "platform" },
];

const TYPE_OPTIONS: { label: string; value: FinanceiroEntryType }[] = [
  { label: "Entrada", value: "income" },
  { label: "Saida", value: "expense" },
];

const STATUS_OPTIONS: { label: string; value: FinanceiroEntryStatus }[] = [
  { label: "Pendente", value: "pending" },
  { label: "Pago", value: "paid" },
  { label: "Atrasado", value: "overdue" },
];

const RECURRENCE_OPTIONS: { label: string; value: FinanceiroEntryRecurrence }[] = [
  { label: "Pontual", value: "none" },
  { label: "Mensal", value: "monthly" },
  { label: "Anual", value: "yearly" },
];

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function defaultFormState(): EntryFormState {
  return {
    type: "expense",
    projectId: "none",
    category: "",
    title: "",
    description: "",
    counterpartyName: "",
    amount: "",
    status: "pending",
    dueDate: todayDateInput(),
    paidAt: "",
    competencyDate: "",
    recurrence: "none",
    alertDaysBefore: "7",
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

function normalizeStatusForSave(form: EntryFormState) {
  if (form.status === "paid" || form.paidAt) return "paid";
  if (form.status === "overdue") return "overdue";

  const dueDate = new Date(form.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueAt = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return dueAt < today ? "overdue" : "pending";
}

function mapEntriesWithProjects(entries: FinancialEntry[], projects: FinanceiroProject[]): FinanceiroEntryWithProject[] {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  return entries.map((entry) => ({
    ...entry,
    project: entry.project_id ? projectMap.get(entry.project_id) || null : null,
  }));
}

function groupEntries(entries: FinanceiroEntryWithProject[]) {
  return {
    overdue: entries.filter((entry) => getFinanceiroVisualStatus(entry) === "overdue"),
    upcoming: entries.filter((entry) => getFinanceiroVisualStatus(entry) === "upcoming"),
    paid: entries.filter((entry) => getFinanceiroVisualStatus(entry) === "paid"),
    pending: entries.filter((entry) => getFinanceiroVisualStatus(entry) === "pending"),
  };
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
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={cn("h-4 w-4", iconClass)} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

export default function FinanceiroPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<FinanceiroProject[]>([]);
  const [entries, setEntries] = useState<FinanceiroEntryWithProject[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FinanceiroFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceiroEntryWithProject | null>(null);
  const [form, setForm] = useState<EntryFormState>(defaultFormState);

  useEffect(() => {
    if (searchParams?.get("compose") === "entry") {
      setDialogOpen(true);
    }
  }, [searchParams]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    const [projectsRes, entriesRes] = await Promise.all([
      financeiroApi.db.from("projects").select("id, name, client, color").order("name"),
      financeiroApi.db.from("financial_entries").select("*").order("due_date", { ascending: true }),
    ]);

    if (projectsRes.error) {
      toast.error("Nao foi possivel carregar as empresas.");
    }

    if (entriesRes.error) {
      toast.error("Nao foi possivel carregar os lancamentos financeiros.");
    }

    const nextProjects = (projectsRes.data || []) as FinanceiroProject[];
    const nextEntries = (entriesRes.data || []) as FinancialEntry[];

    setProjects(nextProjects);
    setEntries(mapEntriesWithProjects(nextEntries, nextProjects));
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      void loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function resetForm() {
    setEditingEntry(null);
    setForm(defaultFormState());
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(entry: FinanceiroEntryWithProject) {
    setEditingEntry(entry);
    setForm({
      type: entry.type,
      projectId: entry.project_id || "none",
      category: entry.category,
      title: entry.title,
      description: entry.description || "",
      counterpartyName: entry.counterparty_name,
      amount: String(entry.amount),
      status: entry.status,
      dueDate: toDateInput(entry.due_date),
      paidAt: toDateTimeLocalInput(entry.paid_at),
      competencyDate: toDateInput(entry.competency_date),
      recurrence: entry.recurrence,
      alertDaysBefore: String(entry.alert_days_before || 7),
      isPlatformCost: entry.is_platform_cost,
      notes: entry.notes || "",
    });
    setDialogOpen(true);
  }

  async function saveEntry() {
    if (!user) return;
    if (!form.title.trim() || !form.category.trim() || !form.counterpartyName.trim() || !form.dueDate || !form.amount) {
      toast.error("Preencha titulo, categoria, contraparte, valor e vencimento.");
      return;
    }

    setSaving(true);

    const payload = {
      project_id: form.projectId === "none" ? null : form.projectId,
      type: form.type,
      category: form.category.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      counterparty_name: form.counterpartyName.trim(),
      amount: parseAmount(form.amount),
      currency: "BRL",
      status: normalizeStatusForSave(form),
      due_date: form.dueDate,
      paid_at: fromDateTimeLocalInput(form.paidAt),
      competency_date: form.competencyDate || null,
      recurrence: form.recurrence,
      alert_days_before: Number.parseInt(form.alertDaysBefore, 10) || 7,
      is_platform_cost: form.isPlatformCost,
      notes: form.notes.trim() || null,
    };

    const query = editingEntry
      ? financeiroApi.db.from("financial_entries").update(payload).eq("id", editingEntry.id)
      : financeiroApi.db.from("financial_entries").insert(payload);

    const { error } = await query;

    if (error) {
      toast.error(editingEntry ? "Erro ao atualizar lancamento." : "Erro ao criar lancamento.");
      setSaving(false);
      return;
    }

    toast.success(editingEntry ? "Lancamento atualizado." : "Lancamento criado.");
    setDialogOpen(false);
    resetForm();
    await loadData();
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    const { error } = await financeiroApi.db.from("financial_entries").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir lancamento.");
      return;
    }

    toast.success("Lancamento excluido.");
    await loadData();
  }

  async function markAsPaid(entry: FinanceiroEntryWithProject) {
    const { error } = await financeiroApi.db
      .from("financial_entries")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", entry.id);

    if (error) {
      toast.error("Erro ao marcar lancamento como pago.");
      return;
    }

    toast.success("Lancamento marcado como pago.");
    await loadData();
  }

  const { filteredEntries, metrics } = useFinanceiroFeature({ entries, filter, search });
  const groupedEntries = useMemo(() => groupEntries(filteredEntries), [filteredEntries]);

  if (loading) {
    return <LoadingState message="Carregando financeiro..." />;
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Financeiro"
        description="Controle manual de entradas, saidas, vencimentos e alertas por empresa no stack atual."
        actions={
          <Button onClick={openCreateDialog} className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Novo lancamento
          </Button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <StatsCard icon={ArrowUpCircle} label="A receber" value={formatMoney(metrics.receivableOpen)} helper="Receitas abertas para clientes e contratos" tone="success" />
        <StatsCard icon={ArrowDownCircle} label="A pagar" value={formatMoney(metrics.payableOpen)} helper="Custos operacionais e plataformas pendentes" tone="warning" />
        <StatsCard icon={AlertTriangle} label="Vencidos" value={String(metrics.overdueCount).padStart(2, "0")} helper="Lancamentos fora do prazo" tone={metrics.overdueCount > 0 ? "danger" : "default"} />
        <StatsCard icon={CalendarClock} label="Proximos" value={String(metrics.upcomingCount).padStart(2, "0")} helper="Vencem dentro da janela de alerta" tone={metrics.upcomingCount > 0 ? "warning" : "default"} />
      </section>

      <Card className="rounded-2xl border-border bg-card/95">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-lg">Operacao financeira</CardTitle>
            <CardDescription>Filtre, busque e acompanhe o pipeline de lancamentos.</CardDescription>
          </div>
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por titulo, contraparte, categoria ou empresa"
              className="h-11 rounded-2xl border-border bg-background/60 pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs transition-colors",
                  filter === option.value
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Tabs defaultValue="pipeline">
            <TabsList className="h-auto rounded-2xl border border-border bg-background/40 p-1">
              <TabsTrigger value="pipeline" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                Calendario
              </TabsTrigger>
              <TabsTrigger value="paid" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                Pagos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="mt-5 space-y-5">
              {filteredEntries.length === 0 ? (
                <EmptyState
                  icon={Landmark}
                  title="Nenhum lancamento encontrado"
                  description="Ajuste os filtros ou crie o primeiro registro financeiro manual."
                />
              ) : (
                <>
                  <EntryGroup title="Atrasados" subtitle="Pagamentos e recebimentos fora do prazo" entries={groupedEntries.overdue} onEdit={openEditDialog} onDelete={deleteEntry} onMarkAsPaid={markAsPaid} />
                  <EntryGroup title="Proximos vencimentos" subtitle="Contas dentro da janela de alerta" entries={groupedEntries.upcoming} onEdit={openEditDialog} onDelete={deleteEntry} onMarkAsPaid={markAsPaid} />
                  <EntryGroup title="Pendencias futuras" subtitle="Lancamentos ainda sem risco imediato" entries={groupedEntries.pending} onEdit={openEditDialog} onDelete={deleteEntry} onMarkAsPaid={markAsPaid} />
                </>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-5 space-y-3">
              {filteredEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro disponivel para a linha de vencimentos.</p>
              ) : (
                filteredEntries.map((entry) => {
                  const visualStatus = getFinanceiroVisualStatus(entry);
                  return (
                    <div key={entry.id} className="grid gap-3 rounded-2xl border border-border bg-background/25 p-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Vencimento</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{new Date(entry.due_date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.counterparty_name} | {entry.project?.name || "Sem empresa"} | {formatRecurrenceLabel(entry.recurrence)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={statusClassName(visualStatus)}>{formatVisualStatusLabel(visualStatus)}</Badge>
                        <span className="font-mono text-sm font-semibold text-foreground">{formatMoney(entry.amount)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="paid" className="mt-5">
              <EntryGroup title="Pagos recentes" subtitle="Historico recente de caixa resolvido" entries={groupedEntries.paid} onEdit={openEditDialog} onDelete={deleteEntry} onMarkAsPaid={markAsPaid} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Editar lancamento" : "Novo lancamento"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={form.type} onValueChange={(value: FinanceiroEntryType) => setForm((current) => ({ ...current, type: value }))}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Empresa vinculada</Label>
              <Select value={form.projectId} onValueChange={(value) => setForm((current) => ({ ...current, projectId: value }))}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem empresa</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Nome do lancamento</Label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Fatura Figma, Mensalidade cliente X" className="h-11 rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cliente / plataforma / fornecedor</Label>
              <Input value={form.counterpartyName} onChange={(event) => setForm((current) => ({ ...current, counterpartyName: event.target.value }))} placeholder="Ex: Stripe, Google Workspace, Cliente XPTO" className="h-11 rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex: Plataforma, Receita recorrente" className="h-11 rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Valor</Label>
              <Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" className="h-11 rounded-2xl border-border bg-background/60 font-mono" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(value: FinanceiroEntryStatus) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Data de vencimento</Label>
              <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="h-11 rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Data de pagamento</Label>
              <Input type="datetime-local" value={form.paidAt} onChange={(event) => setForm((current) => ({ ...current, paidAt: event.target.value }))} className="h-11 rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Competencia</Label>
              <Input type="date" value={form.competencyDate} onChange={(event) => setForm((current) => ({ ...current, competencyDate: event.target.value }))} className="h-11 rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Recorrencia</Label>
              <Select value={form.recurrence} onValueChange={(value: FinanceiroEntryRecurrence) => setForm((current) => ({ ...current, recurrence: value }))}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Alerta antes do vencimento (dias)</Label>
              <Input type="number" min="0" max="365" value={form.alertDaysBefore} onChange={(event) => setForm((current) => ({ ...current, alertDaysBefore: event.target.value }))} className="h-11 rounded-2xl border-border bg-background/60 font-mono" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Descricao</Label>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Contexto do lancamento" className="min-h-[88px] rounded-2xl border-border bg-background/60" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Observacoes internas" className="min-h-[88px] rounded-2xl border-border bg-background/60" />
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <Checkbox checked={form.isPlatformCost} onCheckedChange={(checked) => setForm((current) => ({ ...current, isPlatformCost: Boolean(checked) }))} id="isPlatformCost" />
              <Label htmlFor="isPlatformCost" className="text-sm text-foreground">
                Marcar como despesa de plataforma para aparecer nos alertas de renovacao
              </Label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              V1 manual: a recorrencia e informativa e nao gera proximas parcelas automaticamente.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-2xl">
                Cancelar
              </Button>
              <Button onClick={saveEntry} disabled={saving} className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? "Salvando..." : editingEntry ? "Salvar alteracoes" : "Criar lancamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryGroup({
  title,
  subtitle,
  entries,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: {
  title: string;
  subtitle: string;
  entries: FinanceiroEntryWithProject[];
  onEdit: (entry: FinanceiroEntryWithProject) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (entry: FinanceiroEntryWithProject) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{title}</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{subtitle}</h3>
        </div>
        <Badge variant="secondary" className="bg-background/60 text-muted-foreground">
          {entries.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} onMarkAsPaid={onMarkAsPaid} />
        ))}
      </div>
    </section>
  );
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: {
  entry: FinanceiroEntryWithProject;
  onEdit: (entry: FinanceiroEntryWithProject) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (entry: FinanceiroEntryWithProject) => void;
}) {
  const visualStatus = getFinanceiroVisualStatus(entry);

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        visualStatus === "overdue"
          ? "border-rose-500/20 bg-rose-500/[0.05]"
          : visualStatus === "upcoming"
            ? "border-amber-500/20 bg-amber-500/[0.05]"
            : "border-border bg-card/95",
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusClassName(visualStatus)}>{formatVisualStatusLabel(visualStatus)}</Badge>
            <Badge variant="secondary" className="bg-background/60 text-muted-foreground">
              {formatEntryTypeLabel(entry.type)}
            </Badge>
            {entry.is_platform_cost ? (
              <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/10">
                Plataforma
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">{entry.category}</span>
          </div>

          <p className="mt-2 text-lg font-semibold text-foreground">{entry.title}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{entry.counterparty_name}</span>
            <span>{entry.project?.name || "Sem empresa vinculada"}</span>
            <span>{describeFinanceiroAmount(entry.type, entry.amount)}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
          <div className="rounded-xl border border-border/70 bg-background/35 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Vencimento</p>
            <div className="mt-2 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">{new Date(entry.due_date).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Recorrencia</p>
            <div className="mt-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-cyan-300" />
              <p className="text-sm font-semibold text-foreground">{formatRecurrenceLabel(entry.recurrence)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-background/60 px-2.5 py-1">{entry.project?.client || "Sem cliente"}</span>
          <span className="rounded-full bg-background/60 px-2.5 py-1">Alerta em {entry.alert_days_before}d</span>
          <span className="rounded-full bg-background/60 px-2.5 py-1">
            {entry.paid_at ? `Pago em ${new Date(entry.paid_at).toLocaleDateString("pt-BR")}` : "Ainda nao pago"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visualStatus !== "paid" ? (
            <Button onClick={() => onMarkAsPaid(entry)} size="sm" className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
              Marcar como pago
            </Button>
          ) : null}

          <Button variant="outline" size="sm" onClick={() => onEdit(entry)} className="gap-1 rounded-xl">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(entry.id)} className="gap-1 rounded-xl text-rose-300 hover:text-rose-200">
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
