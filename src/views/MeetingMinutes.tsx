import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, ClipboardList, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyMeetingMinutesStatus,
  buildMeetingMinutesMeetingOptions,
  buildMeetingMinutesSummary,
  deriveMeetingStatusFromChecklist,
  filterMeetingMinutes,
  MEETING_MINUTES_STATUS_LABEL,
  normalizeMeetingMinutesItem,
  parseChecklistFromText,
  sortMeetingMinutes,
  type MeetingMinutesMeetingOption,
} from "@/features/atas/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { db } from "@/lib/dbClient";
import { cn } from "@/lib/utils";
import type {
  MeetingMinutesChecklistEntry,
  MeetingMinutesItem,
  MeetingMinutesStatus,
} from "@/types";

const ALL_STATUS_VALUE = "__all_status__";
const ALL_MEETINGS_VALUE = "__all_meetings__";

function withGeneratedChecklistIds(entries: MeetingMinutesChecklistEntry[]) {
  return entries.map((entry, index) => ({
    ...entry,
    id: entry.id || `item_${index + 1}_${Date.now()}`,
  }));
}

function formatMeetingOptionLabel(meeting: MeetingMinutesMeetingOption) {
  const start = parseISO(meeting.start);
  if (Number.isNaN(start.getTime())) {
    return meeting.summary;
  }

  const when = meeting.allDay
    ? format(start, "dd/MM/yyyy", { locale: ptBR })
    : format(start, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });

  return `${when} - ${meeting.summary}`;
}

function formatMeetingSnapshot(startAt: string) {
  const date = parseISO(startAt);
  if (Number.isNaN(date.getTime())) return "Data indisponivel";
  return format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
}

function getStatusBadgeClass(status: MeetingMinutesStatus) {
  if (status === "resolved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "in_progress") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

export default function MeetingMinutesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const {
    events: calendarEvents,
    fetchEvents,
    loading: meetingsLoading,
    connected: meetingsConnected,
    connectionReady,
  } = useGoogleCalendar();

  const [items, setItems] = useState<MeetingMinutesItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MeetingMinutesStatus>("all");
  const [meetingFilterId, setMeetingFilterId] = useState<string | null>(null);
  const [newMeetingId, setNewMeetingId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [creating, setCreating] = useState(false);
  const [mutatingItemId, setMutatingItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDetail, setEditingDetail] = useState("");
  const [editingStatus, setEditingStatus] = useState<MeetingMinutesStatus>("pending");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoadingItems(false);
      return;
    }

    let cancelled = false;

    const loadItems = async () => {
      setLoadingItems(true);

      const { data, error } = await db
        .from("agenda_meeting_topics")
        .select("*")
        .order("meeting_start_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        toast.error("Não foi possível carregar as atas.");
        setLoadingItems(false);
        return;
      }

      setItems(
        sortMeetingMinutes(
          ((data || []) as MeetingMinutesItem[]).map((item) => normalizeMeetingMinutesItem(item)),
        ),
      );
      setLoadingItems(false);
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    void fetchEvents(timeMin, timeMax);
  }, [fetchEvents, user]);

  useEffect(() => {
    const meetingId = searchParams?.get("meeting") || null;
    if (!meetingId) return;
    setMeetingFilterId(meetingId);
    setNewMeetingId(meetingId);
  }, [searchParams]);

  const meetingOptions = useMemo(
    () => buildMeetingMinutesMeetingOptions(calendarEvents, items),
    [calendarEvents, items],
  );

  const meetingOptionById = useMemo(
    () => new Map(meetingOptions.map((meeting) => [meeting.id, meeting])),
    [meetingOptions],
  );

  const summary = useMemo(() => buildMeetingMinutesSummary(items), [items]);

  const filteredItems = useMemo(
    () =>
      sortMeetingMinutes(
        filterMeetingMinutes(items, {
          search,
          status: statusFilter,
          meetingEventId: meetingFilterId,
        }),
      ),
    [items, meetingFilterId, search, statusFilter],
  );

  const selectedMeetingLabel = useMemo(() => {
    if (!meetingFilterId) return null;
    const meeting = meetingOptionById.get(meetingFilterId);
    return meeting ? formatMeetingOptionLabel(meeting) : meetingFilterId;
  }, [meetingFilterId, meetingOptionById]);

  const meetingFilterValue =
    meetingFilterId && meetingOptionById.has(meetingFilterId)
      ? meetingFilterId
      : ALL_MEETINGS_VALUE;

  const createMeetingValue =
    newMeetingId && meetingOptionById.has(newMeetingId)
      ? newMeetingId
      : ALL_MEETINGS_VALUE;

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDetail("");
  };

  const createItem = async () => {
    if (!newMeetingId) {
      toast.error("Selecione uma reunião.");
      return;
    }

    if (!newTitle.trim()) {
      toast.error("O título do item e obrigatório.");
      return;
    }

    const meeting = meetingOptionById.get(newMeetingId);
    if (!meeting) {
      toast.error("A reunião selecionada não esta disponível.");
      return;
    }

    setCreating(true);
    const parsedChecklist = withGeneratedChecklistIds(parseChecklistFromText(newDetail));
    const initialStatus = deriveMeetingStatusFromChecklist(parsedChecklist, "pending");

    const { data, error } = await db
      .from("agenda_meeting_topics")
      .insert({
        meeting_event_id: meeting.id,
        meeting_series_key: meeting.seriesKey,
        meeting_start_at: meeting.start,
        meeting_summary: meeting.summary,
        title: newTitle.trim(),
        detail: newDetail.trim() || null,
        checklist_json: parsedChecklist,
        status: initialStatus,
        completed_at: initialStatus === "resolved" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    setCreating(false);

    if (error || !data) {
      toast.error("Não foi possível criar o item da ata.");
      return;
    }

    setItems((current) =>
      sortMeetingMinutes([
        normalizeMeetingMinutesItem(data as MeetingMinutesItem),
        ...current,
      ]),
    );
    resetCreateForm();
    toast.success("Item da ata criado.");
  };

  const updateItemStatus = async (
    item: MeetingMinutesItem,
    status: MeetingMinutesStatus,
  ) => {
    const nextItem = applyMeetingMinutesStatus(item, status, new Date().toISOString());
    const nextChecklist = item.checklist_json.length
      ? item.checklist_json.map((entry) => ({
          ...entry,
          completed: status === "resolved" ? true : status === "pending" ? false : entry.completed,
        }))
      : item.checklist_json;
    setMutatingItemId(item.id);

    const { data, error } = await db
      .from("agenda_meeting_topics")
      .update({
        status: nextItem.status,
        completed_at: nextItem.completed_at,
        checklist_json: nextChecklist,
      })
      .eq("id", item.id)
      .select("*")
      .single();

    setMutatingItemId(null);

    if (error || !data) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }

    const normalized = normalizeMeetingMinutesItem(data as MeetingMinutesItem);
    setItems((current) =>
      sortMeetingMinutes(
        current.map((currentItem) =>
          currentItem.id === normalized.id ? normalized : currentItem,
        ),
      ),
    );
  };

  const deleteItem = async (item: MeetingMinutesItem) => {
    const confirmed = window.confirm("Excluir este item da ata? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    setMutatingItemId(item.id);
    const { error } = await db
      .from("agenda_meeting_topics")
      .delete()
      .eq("id", item.id);
    setMutatingItemId(null);

    if (error) {
      toast.error("Não foi possível excluir o item.");
      return;
    }

    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    toast.success("Item excluido.");
  };

  const toggleChecklistEntry = async (
    item: MeetingMinutesItem,
    sourceChecklist: MeetingMinutesChecklistEntry[],
    entryId: string,
    checked: boolean,
  ) => {
    const nextChecklist = sourceChecklist.map((entry) =>
      entry.id === entryId ? { ...entry, completed: checked } : entry,
    );
    const nextStatus = deriveMeetingStatusFromChecklist(nextChecklist, item.status);
    const completedAt = nextStatus === "resolved" ? new Date().toISOString() : null;

    setMutatingItemId(item.id);
    const { data, error } = await db
      .from("agenda_meeting_topics")
      .update({
        checklist_json: nextChecklist,
        status: nextStatus,
        completed_at: completedAt,
      })
      .eq("id", item.id)
      .select("*")
      .single();
    setMutatingItemId(null);

    if (error || !data) {
      toast.error("Não foi possível atualizar checklist.");
      return;
    }

    const normalized = normalizeMeetingMinutesItem(data as MeetingMinutesItem);
    setItems((current) =>
      sortMeetingMinutes(
        current.map((currentItem) =>
          currentItem.id === normalized.id ? normalized : currentItem,
        ),
      ),
    );
  };

  const openEditDialog = (item: MeetingMinutesItem) => {
    setEditingItemId(item.id);
    setEditingTitle(item.title);
    setEditingDetail(item.detail || "");
    setEditingStatus(item.status);
  };

  const closeEditDialog = () => {
    setEditingItemId(null);
    setEditingTitle("");
    setEditingDetail("");
    setEditingStatus("pending");
  };

  const saveEdit = async () => {
    if (!editingItemId) return;
    if (!editingTitle.trim()) {
      toast.error("O título do item e obrigatório.");
      return;
    }

    setSavingEdit(true);
    const currentItem = items.find((item) => item.id === editingItemId);
    const parsedChecklist = withGeneratedChecklistIds(parseChecklistFromText(editingDetail));
    const mergedChecklist = parsedChecklist.length
      ? parsedChecklist.map((entry) => {
          const existing = currentItem?.checklist_json.find((item) => item.title === entry.title);
          return existing ? { ...entry, completed: existing.completed } : entry;
        })
      : currentItem?.checklist_json || [];
    const statusFromChecklist = deriveMeetingStatusFromChecklist(
      mergedChecklist,
      editingStatus,
    );

    const { data, error } = await db
      .from("agenda_meeting_topics")
      .update({
        title: editingTitle.trim(),
        detail: editingDetail.trim() || null,
        checklist_json: mergedChecklist,
        status: statusFromChecklist,
        completed_at: statusFromChecklist === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", editingItemId)
      .select("*")
      .single();

    setSavingEdit(false);

    if (error || !data) {
      toast.error("Não foi possível salvar a edição.");
      return;
    }

    const normalized = normalizeMeetingMinutesItem(data as MeetingMinutesItem);
    setItems((current) =>
      sortMeetingMinutes(
        current.map((item) => (item.id === normalized.id ? normalized : item)),
      ),
    );
    closeEditDialog();
    toast.success("Item atualizado.");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Atas"
        description="Transforme decisoes de reunião em checklist acionavel, com snapshot da reunião e status de acompanhamento."
        actions={(
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/agenda">Abrir agenda</Link>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
                void fetchEvents(timeMin, timeMax);
              }}
            >
              <RefreshCw className={cn("h-4 w-4", meetingsLoading && "animate-spin")} />
              Atualizar reuniões
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.pending}</p>
          <p className="text-xs text-muted-foreground">Itens ainda sem execução iniciada.</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Em andamento</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.in_progress}</p>
          <p className="text-xs text-muted-foreground">Pendências em acompanhamento ativo.</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resolvidos</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.resolved}</p>
          <p className="text-xs text-muted-foreground">Itens concluidos e marcados em check.</p>
        </div>
      </div>

      {!meetingsConnected && connectionReady && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          Google Calendar não conectado. Você ainda pode consultar itens antigos pelas snapshots salvas, mas a criação de novos itens exige reuniões carregadas.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Novo item</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Checklist da reunião</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vincule cada item a uma reunião para manter contexto e histórico visível.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Reunião</Label>
            <Select
              value={createMeetingValue}
              onValueChange={(value) => setNewMeetingId(value === ALL_MEETINGS_VALUE ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma reunião" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MEETINGS_VALUE}>Selecione uma reunião</SelectItem>
                {meetingOptions.map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id}>
                    {formatMeetingOptionLabel(meeting)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Ex.: enviar proposta revisada"
            />
          </div>

          <div className="space-y-2">
            <Label>Detalhe</Label>
            <Textarea
              value={newDetail}
              onChange={(event) => setNewDetail(event.target.value)}
              placeholder="Contexto, dependências ou combinados da reunião"
              rows={5}
            />
          </div>

          <Button
            className="w-full gap-2"
            disabled={creating || meetingOptions.length === 0}
            onClick={() => {
              void createItem();
            }}
          >
            <ClipboardList className="h-4 w-4" />
            {creating ? "Criando..." : "Adicionar item"}
          </Button>

          {meetingOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma reunião disponível para vincular no momento.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Visão consolidada</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Itens das atas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Filtre por reunião, texto ou status e marque rapidamente o que já foi concluido.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setMeetingFilterId(null);
              }}
            >
              Limpar filtros
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_260px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, detalhe ou reunião"
            />

            <Select
              value={statusFilter === "all" ? ALL_STATUS_VALUE : statusFilter}
              onValueChange={(value) =>
                setStatusFilter(
                  value === ALL_STATUS_VALUE ? "all" : (value as MeetingMinutesStatus),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUS_VALUE}>Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={meetingFilterValue}
              onValueChange={(value) =>
                setMeetingFilterId(value === ALL_MEETINGS_VALUE ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as reuniões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MEETINGS_VALUE}>Todas as reuniões</SelectItem>
                {meetingOptions.map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id}>
                    {formatMeetingOptionLabel(meeting)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMeetingLabel && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Filtro ativo por reuniao: <span className="font-medium text-foreground">{selectedMeetingLabel}</span>
            </div>
          )}

          {loadingItems ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-primary/70" />
              <p className="text-sm font-medium text-foreground">Nenhum item encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste os filtros ou crie um novo item a partir de uma reunião.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                (() => {
                  const checklistEntries = item.checklist_json.length
                    ? item.checklist_json
                    : parseChecklistFromText(item.detail || "");
                  const showPlainDetail = Boolean(item.detail) && checklistEntries.length === 0;

                  return (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-xl border border-border bg-background/25 p-4 transition-colors",
                    item.status === "resolved" && "border-emerald-500/20 bg-emerald-500/5",
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.status === "resolved"}
                          disabled={mutatingItemId === item.id}
                          onCheckedChange={(checked) => {
                            void updateItemStatus(item, checked ? "resolved" : "pending");
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                "text-sm font-semibold text-foreground",
                                item.status === "resolved" && "line-through opacity-80",
                              )}
                            >
                              {item.title}
                            </p>
                            <Badge className={cn("border", getStatusBadgeClass(item.status))}>
                              {MEETING_MINUTES_STATUS_LABEL[item.status]}
                            </Badge>
                            {item.status === "resolved" && (
                              <Badge variant="outline" className="border-emerald-500/30 text-emerald-200">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Check
                              </Badge>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.meeting_summary} - {formatMeetingSnapshot(item.meeting_start_at)}
                          </p>

                          {showPlainDetail && item.detail && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                              {item.detail}
                            </p>
                          )}

                          {checklistEntries.length > 0 && (
                            <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                Checklist da reunião
                              </p>
                              <div className="space-y-1.5">
                                {checklistEntries.map((entry) => (
                                  <label
                                    key={entry.id}
                                    className="flex items-start gap-2 text-sm text-foreground"
                                  >
                                    <Checkbox
                                      checked={entry.completed}
                                      disabled={mutatingItemId === item.id}
                                      onCheckedChange={(checked) => {
                                        void toggleChecklistEntry(
                                          item,
                                          checklistEntries,
                                          entry.id,
                                          Boolean(checked),
                                        );
                                      }}
                                      className="mt-0.5"
                                    />
                                    <span className={cn("whitespace-pre-wrap break-words", entry.completed && "line-through text-muted-foreground")}>
                                      {entry.title}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Link
                              href="/agenda"
                              className="inline-flex items-center rounded-md border border-border px-2 py-1 hover:text-foreground"
                            >
                              Abrir agenda
                            </Link>
                            <Link
                              href={`/atas?meeting=${encodeURIComponent(item.meeting_event_id)}`}
                              className="inline-flex items-center rounded-md border border-border px-2 py-1 hover:text-foreground"
                            >
                              Filtrar esta reunião
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 lg:pl-4">
                      {item.status !== "in_progress" && item.status !== "resolved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutatingItemId === item.id}
                          onClick={() => {
                            void updateItemStatus(item, "in_progress");
                          }}
                        >
                          Em andamento
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(item)}
                        disabled={mutatingItemId === item.id}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          void deleteItem(item);
                        }}
                        disabled={mutatingItemId === item.id}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>
                  );
                })()
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={editingItemId !== null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar item da ata</DialogTitle>
            <DialogDescription>
              Ajuste texto e status sem perder o vínculo com a reunião original.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Detalhe</Label>
              <Textarea
                rows={5}
                value={editingDetail}
                onChange={(event) => setEditingDetail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editingStatus}
                onValueChange={(value) => setEditingStatus(value as MeetingMinutesStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeEditDialog}>
                Cancelar
              </Button>
              <Button
                disabled={savingEdit}
                onClick={() => {
                  void saveEdit();
                }}
              >
                {savingEdit ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
