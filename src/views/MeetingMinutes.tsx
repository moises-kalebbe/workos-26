import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Link2, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendar, type CalendarEvent } from "@/hooks/useGoogleCalendar";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type MeetingTopicStatus = "pending" | "in_progress" | "resolved";
type MeetingTopicRow = Tables<"agenda_meeting_topics">;
type StatusFilter = "all" | MeetingTopicStatus;

type MeetingTopic = Omit<MeetingTopicRow, "status"> & {
  status: MeetingTopicStatus;
};

type MeetingOption = {
  id: string;
  seriesKey: string;
  summary: string;
  start: string;
  allDay: boolean;
};

type MeetingGroup = {
  meetingEventId: string;
  meetingSummary: string;
  meetingStartAt: string;
  topics: MeetingTopic[];
};

const STATUS_LABEL: Record<MeetingTopicStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  resolved: "Resolvido",
};

const NO_MEETING_VALUE = "__no_meeting__";
const NO_PROJECT_VALUE = "__no_project__";

function normalizeStatus(value: string | null | undefined): MeetingTopicStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return "pending";
}

function parseTagsInput(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
}

function normalizeTopic(row: MeetingTopicRow): MeetingTopic {
  return {
    ...row,
    status: normalizeStatus(row.status),
    tags: Array.isArray(row.tags) ? parseTagsInput(row.tags.join(",")) : [],
  };
}

function formatMeetingDate(value: string) {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function formatMeetingLabel(meeting: Pick<MeetingOption, "summary" | "start" | "allDay">) {
  const start = parseISO(meeting.start);
  if (Number.isNaN(start.getTime())) {
    return meeting.summary;
  }

  const when = meeting.allDay
    ? format(start, "dd/MM/yyyy", { locale: ptBR })
    : format(start, "dd/MM HH:mm", { locale: ptBR });

  return `${when} - ${meeting.summary}`;
}

function toMeetingOptionFromTopic(topic: MeetingTopic): MeetingOption {
  return {
    id: topic.meeting_event_id,
    seriesKey: topic.meeting_series_key,
    summary: topic.meeting_summary,
    start: topic.meeting_start_at,
    allDay: false,
  };
}

function toMeetingOptionFromCalendar(event: CalendarEvent): MeetingOption {
  return {
    id: event.id,
    seriesKey: event.seriesKey,
    summary: event.summary,
    start: event.start,
    allDay: event.allDay,
  };
}

export default function MeetingMinutesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const {
    events: calendarEvents,
    fetchEvents,
    connectionState,
    isInitialLoading: calendarInitialLoading,
    isRefreshing: calendarRefreshing,
  } = useGoogleCalendar();

  const [topics, setTopics] = useState<MeetingTopic[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [mutatingTopicId, setMutatingTopicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [newMeetingId, setNewMeetingId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newConclusion, setNewConclusion] = useState("");
  const [newStatus, setNewStatus] = useState<MeetingTopicStatus>("pending");
  const [newProjectId, setNewProjectId] = useState("");
  const [newTagsInput, setNewTagsInput] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingMeetingId, setEditingMeetingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDetail, setEditingDetail] = useState("");
  const [editingConclusion, setEditingConclusion] = useState("");
  const [editingStatus, setEditingStatus] = useState<MeetingTopicStatus>("pending");
  const [editingProjectId, setEditingProjectId] = useState("");
  const [editingTagsInput, setEditingTagsInput] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [linkTargetByTopicId, setLinkTargetByTopicId] = useState<Record<string, string>>({});

  const loadTopics = useCallback(async () => {
    if (!userId) {
      setLoadingTopics(false);
      return;
    }

    setLoadingTopics(true);

    try {
      const { data, error } = await supabase
        .from("agenda_meeting_topics")
        .select("*")
        .order("meeting_start_at", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setTopics(((data || []) as MeetingTopicRow[]).map(normalizeTopic));
    } catch (loadError) {
      toast.error((loadError as Error).message || "Falha ao carregar atas");
    } finally {
      setLoadingTopics(false);
    }
  }, [userId]);

  const loadProjects = useCallback(async () => {
    if (!userId) {
      setLoadingProjects(false);
      return;
    }

    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("name");

      if (error) {
        throw error;
      }

      setProjects((data || []) as unknown as Project[]);
    } catch (projectError) {
      toast.error((projectError as Error).message || "Falha ao carregar empresas");
    } finally {
      setLoadingProjects(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!userId) return;

    const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    void fetchEvents(start, end);
  }, [userId, fetchEvents]);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const meetingOptions = useMemo(() => {
    const meetingsById = new Map<string, MeetingOption>();

    for (const event of calendarEvents) {
      meetingsById.set(event.id, toMeetingOptionFromCalendar(event));
    }

    for (const topic of topics) {
      if (!meetingsById.has(topic.meeting_event_id)) {
        meetingsById.set(topic.meeting_event_id, toMeetingOptionFromTopic(topic));
      }
    }

    return [...meetingsById.values()].sort((a, b) => {
      const aTime = parseISO(a.start).getTime();
      const bTime = parseISO(b.start).getTime();
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      return safeBTime - safeATime;
    });
  }, [calendarEvents, topics]);

  const meetingById = useMemo(
    () => new Map(meetingOptions.map((meeting) => [meeting.id, meeting])),
    [meetingOptions],
  );

  const filteredTopics = useMemo(() => {
    const term = search.trim().toLowerCase();

    return topics.filter((topic) => {
      if (statusFilter !== "all" && topic.status !== statusFilter) {
        return false;
      }

      if (!term) return true;

      const projectName = topic.project_id ? projectById.get(topic.project_id)?.name || "" : "";
      const haystack = [
        topic.meeting_summary,
        topic.title,
        topic.detail,
        topic.conclusion,
        projectName,
        topic.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [topics, search, statusFilter, projectById]);

  const meetingGroups = useMemo(() => {
    const groups = new Map<string, MeetingGroup>();

    for (const topic of filteredTopics) {
      const key = topic.meeting_event_id;
      const current = groups.get(key);

      if (!current) {
        groups.set(key, {
          meetingEventId: topic.meeting_event_id,
          meetingSummary: topic.meeting_summary,
          meetingStartAt: topic.meeting_start_at,
          topics: [topic],
        });
        continue;
      }

      current.topics.push(topic);
    }

    const result = [...groups.values()];
    result.sort((a, b) => parseISO(b.meetingStartAt).getTime() - parseISO(a.meetingStartAt).getTime());
    result.forEach((group) => {
      group.topics.sort((a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime());
    });

    return result;
  }, [filteredTopics]);

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDetail("");
    setNewConclusion("");
    setNewStatus("pending");
    setNewProjectId("");
    setNewTagsInput("");
  };

  const createTopic = async () => {
    if (!userId) return;
    if (!newTitle.trim()) {
      toast.error("Titulo da ata e obrigatorio");
      return;
    }

    const selectedMeeting = meetingById.get(newMeetingId);
    if (!selectedMeeting) {
      toast.error("Selecione uma reuniao para vincular");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("agenda_meeting_topics")
        .insert({
          user_id: userId,
          meeting_event_id: selectedMeeting.id,
          meeting_series_key: selectedMeeting.seriesKey,
          meeting_start_at: selectedMeeting.start,
          meeting_summary: selectedMeeting.summary,
          title: newTitle.trim(),
          detail: newDetail.trim(),
          conclusion: newConclusion.trim(),
          status: newStatus,
          project_id: newProjectId || null,
          tags: parseTagsInput(newTagsInput),
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const created = normalizeTopic(data as MeetingTopicRow);
      setTopics((prev) => [created, ...prev]);
      resetCreateForm();
      toast.success("Ata criada");
    } catch (createError) {
      toast.error((createError as Error).message || "Falha ao criar ata");
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (topic: MeetingTopic) => {
    setEditingTopicId(topic.id);
    setEditingMeetingId(topic.meeting_event_id);
    setEditingTitle(topic.title);
    setEditingDetail(topic.detail);
    setEditingConclusion(topic.conclusion);
    setEditingStatus(topic.status);
    setEditingProjectId(topic.project_id || "");
    setEditingTagsInput(topic.tags.join(", "));
  };

  const cancelEditing = () => {
    setEditingTopicId(null);
    setEditingMeetingId("");
    setEditingTitle("");
    setEditingDetail("");
    setEditingConclusion("");
    setEditingStatus("pending");
    setEditingProjectId("");
    setEditingTagsInput("");
  };

  const saveEditing = async () => {
    if (!editingTopicId) return;
    if (!editingTitle.trim()) {
      toast.error("Titulo da ata e obrigatorio");
      return;
    }

    const currentTopic = topics.find((topic) => topic.id === editingTopicId);
    if (!currentTopic) {
      toast.error("Ata nao encontrada");
      return;
    }

    const selectedMeeting = meetingById.get(editingMeetingId) || toMeetingOptionFromTopic(currentTopic);

    setSavingEdit(true);
    try {
      const { data, error } = await supabase
        .from("agenda_meeting_topics")
        .update({
          meeting_event_id: selectedMeeting.id,
          meeting_series_key: selectedMeeting.seriesKey,
          meeting_start_at: selectedMeeting.start,
          meeting_summary: selectedMeeting.summary,
          title: editingTitle.trim(),
          detail: editingDetail.trim(),
          conclusion: editingConclusion.trim(),
          status: editingStatus,
          project_id: editingProjectId || null,
          tags: parseTagsInput(editingTagsInput),
        })
        .eq("id", editingTopicId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = normalizeTopic(data as MeetingTopicRow);
      setTopics((prev) => prev.map((topic) => (topic.id === updated.id ? updated : topic)));
      toast.success("Ata atualizada");
      cancelEditing();
    } catch (updateError) {
      toast.error((updateError as Error).message || "Falha ao atualizar ata");
    } finally {
      setSavingEdit(false);
    }
  };

  const changeTopicStatus = async (topicId: string, status: MeetingTopicStatus) => {
    setMutatingTopicId(topicId);
    try {
      const { error } = await supabase
        .from("agenda_meeting_topics")
        .update({ status })
        .eq("id", topicId);

      if (error) {
        throw error;
      }

      setTopics((prev) =>
        prev.map((topic) => (topic.id === topicId ? { ...topic, status } : topic)),
      );
    } catch (updateError) {
      toast.error((updateError as Error).message || "Falha ao atualizar status");
    } finally {
      setMutatingTopicId(null);
    }
  };

  const deleteTopic = async (topicId: string) => {
    setMutatingTopicId(topicId);
    try {
      const { error } = await supabase
        .from("agenda_meeting_topics")
        .delete()
        .eq("id", topicId);

      if (error) {
        throw error;
      }

      setTopics((prev) => prev.filter((topic) => topic.id !== topicId));
      toast.success("Ata removida");
      if (editingTopicId === topicId) {
        cancelEditing();
      }
    } catch (deleteError) {
      toast.error((deleteError as Error).message || "Falha ao remover ata");
    } finally {
      setMutatingTopicId(null);
    }
  };

  const linkTopicToMeeting = async (topic: MeetingTopic) => {
    const targetMeetingId = linkTargetByTopicId[topic.id];
    if (!targetMeetingId) {
      toast.error("Selecione a reuniao alvo");
      return;
    }

    const targetMeeting = meetingById.get(targetMeetingId);
    if (!targetMeeting) {
      toast.error("Reuniao alvo nao encontrada");
      return;
    }

    setMutatingTopicId(topic.id);
    try {
      const { data, error } = await supabase
        .from("agenda_meeting_topics")
        .update({
          meeting_event_id: targetMeeting.id,
          meeting_series_key: targetMeeting.seriesKey,
          meeting_start_at: targetMeeting.start,
          meeting_summary: targetMeeting.summary,
        })
        .eq("id", topic.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = normalizeTopic(data as MeetingTopicRow);
      setTopics((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setLinkTargetByTopicId((prev) => ({ ...prev, [topic.id]: "" }));
      toast.success("Ata vinculada a nova reuniao");
    } catch (linkError) {
      toast.error((linkError as Error).message || "Falha ao vincular reuniao");
    } finally {
      setMutatingTopicId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atas</h1>
          <p className="text-sm text-muted-foreground">
            Criar, editar, excluir e vincular atas em reunioes existentes com empresa e tags.
          </p>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            void Promise.all([loadTopics(), loadProjects()]);
          }}
          disabled={loadingTopics || loadingProjects}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Nova ata / topico</p>
          {(calendarInitialLoading || calendarRefreshing) && (
            <span className="text-xs text-muted-foreground">Carregando reunioes do calendario...</span>
          )}
          {connectionState === "disconnected" && (
            <span className="text-xs text-muted-foreground">
              Google Calendar desconectado. Use reunioes ja registradas nas atas.
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Reuniao vinculada</Label>
            <Select
              value={newMeetingId || NO_MEETING_VALUE}
              onValueChange={(value) => setNewMeetingId(value === NO_MEETING_VALUE ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma reuniao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MEETING_VALUE}>Selecionar reuniao</SelectItem>
                {meetingOptions.map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id}>
                    {formatMeetingLabel(meeting)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Select
              value={newProjectId || NO_PROJECT_VALUE}
              onValueChange={(value) => setNewProjectId(value === NO_PROJECT_VALUE ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT_VALUE}>Sem empresa</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_200px]">
          <div className="space-y-1.5">
            <Label>Titulo</Label>
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Titulo da ata"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={newStatus} onValueChange={(value) => setNewStatus(value as MeetingTopicStatus)}>
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
        </div>

        <div className="space-y-1.5">
          <Label>Tags (separadas por virgula)</Label>
          <Input
            value={newTagsInput}
            onChange={(event) => setNewTagsInput(event.target.value)}
            placeholder="ex: onboarding, ia, suporte"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Detalhe</Label>
            <Textarea
              value={newDetail}
              onChange={(event) => setNewDetail(event.target.value)}
              placeholder="Contexto da ata"
              className="min-h-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Conclusao</Label>
            <Textarea
              value={newConclusion}
              onChange={(event) => setNewConclusion(event.target.value)}
              placeholder="Decisao ou proximo passo"
              className="min-h-20"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            className="gap-1"
            disabled={creating || meetingOptions.length === 0}
            onClick={() => {
              void createTopic();
            }}
          >
            <Plus className="h-4 w-4" />
            {creating ? "Criando..." : "Criar ata"}
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por reuniao, titulo, detalhe, conclusao, empresa ou tags"
          className="md:flex-1"
        />

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="md:w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadingTopics ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Carregando atas...
        </div>
      ) : meetingGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetingGroups.map((group) => (
            <section key={group.meetingEventId} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-foreground">{group.meetingSummary}</p>
                  <p className="text-xs text-muted-foreground">{formatMeetingDate(group.meetingStartAt)}</p>
                </div>
                <Badge variant="outline">{group.topics.length} ata(s)</Badge>
              </div>

              <div className="space-y-3">
                {group.topics.map((topic) => {
                  const isEditing = editingTopicId === topic.id;
                  const isMutating = mutatingTopicId === topic.id;
                  const linkTarget = linkTargetByTopicId[topic.id] || "";
                  const linkValue = linkTarget || NO_MEETING_VALUE;
                  const projectName = topic.project_id ? projectById.get(topic.project_id)?.name : null;

                  if (isEditing) {
                    return (
                      <div key={topic.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
                        <div className="space-y-1.5">
                          <Label>Titulo</Label>
                          <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Reuniao vinculada</Label>
                            <Select
                              value={editingMeetingId || NO_MEETING_VALUE}
                              onValueChange={(value) => setEditingMeetingId(value === NO_MEETING_VALUE ? "" : value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_MEETING_VALUE}>Selecionar reuniao</SelectItem>
                                {meetingOptions.map((meeting) => (
                                  <SelectItem key={meeting.id} value={meeting.id}>
                                    {formatMeetingLabel(meeting)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label>Empresa</Label>
                            <Select
                              value={editingProjectId || NO_PROJECT_VALUE}
                              onValueChange={(value) => setEditingProjectId(value === NO_PROJECT_VALUE ? "" : value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_PROJECT_VALUE}>Sem empresa</SelectItem>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                          <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select value={editingStatus} onValueChange={(value) => setEditingStatus(value as MeetingTopicStatus)}>
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

                          <div className="space-y-1.5">
                            <Label>Tags</Label>
                            <Input value={editingTagsInput} onChange={(event) => setEditingTagsInput(event.target.value)} />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Detalhe</Label>
                            <Textarea value={editingDetail} onChange={(event) => setEditingDetail(event.target.value)} className="min-h-20" />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Conclusao</Label>
                            <Textarea value={editingConclusion} onChange={(event) => setEditingConclusion(event.target.value)} className="min-h-20" />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={savingEdit}
                            onClick={() => {
                              void saveEditing();
                            }}
                          >
                            <Save className="h-3.5 w-3.5" />
                            {savingEdit ? "Salvando..." : "Salvar"}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={cancelEditing}>
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={topic.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{topic.title}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="outline">{STATUS_LABEL[topic.status]}</Badge>
                            {projectName && <Badge variant="secondary">{projectName}</Badge>}
                            {topic.tags.map((tag) => (
                              <Badge key={`${topic.id}-${tag}`} variant="secondary">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditing(topic)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-danger hover:text-danger"
                            disabled={isMutating}
                            onClick={() => {
                              void deleteTopic(topic.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {topic.detail && <p className="text-xs text-muted-foreground">{topic.detail}</p>}

                      {topic.conclusion && (
                        <p className="text-xs text-foreground/90">
                          <span className="font-semibold">Conclusao:</span> {topic.conclusion}
                        </p>
                      )}

                      <div className="grid gap-2 md:grid-cols-[170px_1fr_auto]">
                        <Select
                          value={topic.status}
                          onValueChange={(value) => {
                            void changeTopicStatus(topic.id, value as MeetingTopicStatus);
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="in_progress">Em andamento</SelectItem>
                            <SelectItem value="resolved">Resolvido</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={linkValue}
                          onValueChange={(value) => {
                            const normalized = value === NO_MEETING_VALUE ? "" : value;
                            setLinkTargetByTopicId((prev) => ({ ...prev, [topic.id]: normalized }));
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Vincular a outra reuniao" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_MEETING_VALUE}>Selecionar reuniao alvo</SelectItem>
                            {meetingOptions.map((meeting) => (
                              <SelectItem key={meeting.id} value={meeting.id}>
                                {formatMeetingLabel(meeting)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          className="h-8 gap-1"
                          disabled={!linkTarget || linkTarget === topic.meeting_event_id || isMutating}
                          onClick={() => {
                            void linkTopicToMeeting(topic);
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Vincular
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
