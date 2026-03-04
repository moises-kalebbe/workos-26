import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { buildMeetingTopicsSummaryText, groupTopicsByStatus, MEETING_TOPIC_STATUS_LABEL } from "@/lib/agendaTopics";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import { useAgendaTopics, type MeetingTopic, type MeetingTopicStatus } from "@/hooks/useAgendaTopics";

type MeetingTopicsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: CalendarEvent | null;
  candidateMeetings: CalendarEvent[];
  topicsApi: ReturnType<typeof useAgendaTopics>;
};

const NO_TARGET_MEETING_VALUE = "__no_target_meeting__";

function formatMeetingLabel(meeting: Pick<CalendarEvent, "summary" | "start" | "allDay">) {
  const start = parseISO(meeting.start);
  if (Number.isNaN(start.getTime())) {
    return meeting.summary;
  }

  const when = meeting.allDay
    ? format(start, "dd/MM/yyyy", { locale: ptBR })
    : format(start, "dd/MM HH:mm", { locale: ptBR });

  return `${when} - ${meeting.summary}`;
}

function hasContent(value: string | null | undefined) {
  return (value || "").trim().length > 0;
}

export function MeetingTopicsDialog({
  open,
  onOpenChange,
  meeting,
  candidateMeetings,
  topicsApi,
}: MeetingTopicsDialogProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newConclusion, setNewConclusion] = useState("");
  const [newStatus, setNewStatus] = useState<MeetingTopicStatus>("pending");
  const [creatingTopic, setCreatingTopic] = useState(false);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDetail, setEditingDetail] = useState("");
  const [editingConclusion, setEditingConclusion] = useState("");
  const [editingStatus, setEditingStatus] = useState<MeetingTopicStatus>("pending");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [copyingTopicId, setCopyingTopicId] = useState<string | null>(null);
  const [copyTargetByTopicId, setCopyTargetByTopicId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !meeting) return;

    void topicsApi.loadTopics(meeting).catch((error) => {
      toast.error((error as Error).message || "Nao foi possivel carregar topicos");
    });
  }, [open, meeting, topicsApi]);

  useEffect(() => {
    if (open) return;

    setEditingTopicId(null);
    setNewTitle("");
    setNewDetail("");
    setNewConclusion("");
    setNewStatus("pending");
  }, [open]);

  const topics = useMemo(() => {
    if (!meeting) return [];
    return topicsApi.getTopics(meeting.id);
  }, [meeting, topicsApi]);

  const groupedTopics = useMemo(() => groupTopicsByStatus(topics), [topics]);

  const isLoadingTopics = useMemo(() => {
    if (!meeting) return false;
    return topicsApi.isMeetingLoading(meeting.id);
  }, [meeting, topicsApi]);

  const targetMeetings = useMemo(() => {
    if (!meeting) return [];

    const uniqueById = new Map<string, CalendarEvent>();
    for (const candidate of candidateMeetings) {
      if (!candidate?.id || uniqueById.has(candidate.id)) continue;
      uniqueById.set(candidate.id, candidate);
    }

    return [...uniqueById.values()]
      .filter((candidate) => candidate.id !== meeting.id)
      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());
  }, [candidateMeetings, meeting]);

  const copyMeetingSummary = async () => {
    if (!meeting) return;

    try {
      const summary = buildMeetingTopicsSummaryText(meeting, topics);
      await navigator.clipboard.writeText(summary);
      toast.success("Resumo copiado");
    } catch {
      toast.error("Nao foi possivel copiar o resumo");
    }
  };

  const resetCreateFields = () => {
    setNewTitle("");
    setNewDetail("");
    setNewConclusion("");
    setNewStatus("pending");
  };

  const handleCreateTopic = async () => {
    if (!meeting) return;
    if (!newTitle.trim()) {
      toast.error("Titulo do topico e obrigatorio");
      return;
    }

    setCreatingTopic(true);
    try {
      await topicsApi.createTopic(meeting, {
        title: newTitle,
        detail: newDetail,
        conclusion: newConclusion,
        status: newStatus,
      });
      toast.success("Topico criado");
      resetCreateFields();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao criar topico");
    } finally {
      setCreatingTopic(false);
    }
  };

  const startEditing = (topic: MeetingTopic) => {
    setEditingTopicId(topic.id);
    setEditingTitle(topic.title);
    setEditingDetail(topic.detail || "");
    setEditingConclusion(topic.conclusion || "");
    setEditingStatus(topic.status);
  };

  const cancelEditing = () => {
    setEditingTopicId(null);
    setEditingTitle("");
    setEditingDetail("");
    setEditingConclusion("");
    setEditingStatus("pending");
  };

  const saveEditing = async () => {
    if (!editingTopicId) return;
    if (!editingTitle.trim()) {
      toast.error("Titulo do topico e obrigatorio");
      return;
    }

    setSavingEdit(true);
    try {
      await topicsApi.updateTopic(editingTopicId, {
        title: editingTitle,
        detail: editingDetail,
        conclusion: editingConclusion,
        status: editingStatus,
      });
      toast.success("Topico atualizado");
      cancelEditing();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao atualizar topico");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteTopic = async (topicId: string) => {
    setDeletingTopicId(topicId);

    try {
      await topicsApi.deleteTopic(topicId);
      toast.success("Topico removido");
      if (editingTopicId === topicId) {
        cancelEditing();
      }
    } catch (error) {
      toast.error((error as Error).message || "Falha ao remover topico");
    } finally {
      setDeletingTopicId(null);
    }
  };

  const copyTopic = async (topic: MeetingTopic) => {
    const targetId = copyTargetByTopicId[topic.id];
    const targetMeeting = targetMeetings.find((item) => item.id === targetId);

    if (!targetMeeting) {
      toast.error("Selecione uma reuniao alvo");
      return;
    }

    setCopyingTopicId(topic.id);
    try {
      await topicsApi.copyTopicToMeeting(topic, targetMeeting);
      toast.success("Topico copiado para a reuniao alvo");
      setCopyTargetByTopicId((prev) => ({ ...prev, [topic.id]: "" }));
    } catch (error) {
      toast.error((error as Error).message || "Falha ao copiar topico");
    } finally {
      setCopyingTopicId(null);
    }
  };

  const renderTopicCard = (topic: MeetingTopic) => {
    const isEditing = editingTopicId === topic.id;
    const isDeleting = deletingTopicId === topic.id;
    const isCopying = copyingTopicId === topic.id;
    const selectedTargetId = copyTargetByTopicId[topic.id] || "";
    const selectValue = selectedTargetId || NO_TARGET_MEETING_VALUE;

    return (
      <div key={topic.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Titulo</Label>
              <Input
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                placeholder="Topico da reuniao"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Detalhe</Label>
              <Textarea
                value={editingDetail}
                onChange={(event) => setEditingDetail(event.target.value)}
                placeholder="Contexto do topico"
                className="min-h-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Conclusao</Label>
              <Textarea
                value={editingConclusion}
                onChange={(event) => setEditingConclusion(event.target.value)}
                placeholder="Resultado ou decisao"
                className="min-h-16"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editingStatus}
                onValueChange={(value) => setEditingStatus(value as MeetingTopicStatus)}
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

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void saveEditing();
                }}
                disabled={savingEdit}
                className="gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                {savingEdit ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEditing} className="gap-1">
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{topic.title}</p>
                <Badge variant="outline" className="mt-1">
                  {MEETING_TOPIC_STATUS_LABEL[topic.status]}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(topic)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-danger hover:text-danger"
                  disabled={isDeleting}
                  onClick={() => {
                    void deleteTopic(topic.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {hasContent(topic.detail) && (
              <p className="text-xs text-muted-foreground">{topic.detail}</p>
            )}

            {hasContent(topic.conclusion) && (
              <div className="rounded-md border border-border bg-card px-2 py-1.5">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Conclusao</p>
                <p className="text-xs text-foreground">{topic.conclusion}</p>
              </div>
            )}

            {targetMeetings.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Select
                  value={selectValue}
                  onValueChange={(value) => {
                    const normalized = value === NO_TARGET_MEETING_VALUE ? "" : value;
                    setCopyTargetByTopicId((prev) => ({ ...prev, [topic.id]: normalized }));
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Copiar para outra reuniao" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TARGET_MEETING_VALUE}>
                      Selecionar reuniao alvo
                    </SelectItem>
                    {targetMeetings.map((targetMeeting) => (
                      <SelectItem key={targetMeeting.id} value={targetMeeting.id}>
                        {formatMeetingLabel(targetMeeting)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  className="h-8"
                  disabled={!selectedTargetId || isCopying}
                  onClick={() => {
                    void copyTopic(topic);
                  }}
                >
                  {isCopying ? "Copiando..." : "Copiar"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma reuniao alvo na agenda carregada.</p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle>Topicos da reuniao</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => void copyMeetingSummary()} className="gap-1">
              <Copy className="h-3.5 w-3.5" />
              Copiar resumo
            </Button>
          </div>
          <DialogDescription>
            {meeting ? formatMeetingLabel(meeting) : "Selecione uma reuniao para gerenciar topicos."}
          </DialogDescription>
          {topicsApi.error && (
            <p className="text-xs text-danger">{topicsApi.error}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          {meeting && (
            <section className="space-y-3 rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-semibold text-foreground">Novo topico</p>

              <div className="space-y-1.5">
                <Label>Titulo</Label>
                <Input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Digite o topico para discussao"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Detalhe</Label>
                  <Textarea
                    value={newDetail}
                    onChange={(event) => setNewDetail(event.target.value)}
                    placeholder="Contexto do topico"
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Conclusao</Label>
                  <Textarea
                    value={newConclusion}
                    onChange={(event) => setNewConclusion(event.target.value)}
                    placeholder="Resultado esperado ou decisao"
                    className="min-h-20"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[180px_auto]">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={newStatus}
                    onValueChange={(value) => setNewStatus(value as MeetingTopicStatus)}
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

                <div className="flex items-end">
                  <Button
                    className="gap-1"
                    disabled={creatingTopic}
                    onClick={() => {
                      void handleCreateTopic();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {creatingTopic ? "Criando..." : "Adicionar topico"}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {isLoadingTopics ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Carregando topicos...
            </div>
          ) : topics.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum topico cadastrado para esta reuniao.
            </div>
          ) : (
            <section className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Pendentes</p>
                  <Badge variant="secondary">{groupedTopics.pending.length}</Badge>
                </div>
                {groupedTopics.pending.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum topico pendente.</p>
                ) : (
                  <div className="space-y-2">
                    {groupedTopics.pending.map(renderTopicCard)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Em andamento</p>
                  <Badge variant="secondary">{groupedTopics.in_progress.length}</Badge>
                </div>
                {groupedTopics.in_progress.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum topico em andamento.</p>
                ) : (
                  <div className="space-y-2">
                    {groupedTopics.in_progress.map(renderTopicCard)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Resolvidos</p>
                  <Badge variant="secondary">{groupedTopics.resolved.length}</Badge>
                </div>
                {groupedTopics.resolved.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum topico resolvido.</p>
                ) : (
                  <div className="space-y-2">
                    {groupedTopics.resolved.map(renderTopicCard)}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
