import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MeetingTopicStatus = "pending" | "in_progress" | "resolved";
type MeetingTopicRow = Tables<"agenda_meeting_topics">;
type StatusFilter = "all" | MeetingTopicStatus;

type MeetingTopic = Omit<MeetingTopicRow, "status"> & {
  status: MeetingTopicStatus;
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

function normalizeStatus(value: string | null | undefined): MeetingTopicStatus {
  if (value === "pending" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return "pending";
}

function normalizeTopic(row: MeetingTopicRow): MeetingTopic {
  return {
    ...row,
    status: normalizeStatus(row.status),
  };
}

function formatMeetingDate(value: string) {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export default function MeetingMinutesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [topics, setTopics] = useState<MeetingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingTopicId, setMutatingTopicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadTopics = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

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
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const filteredTopics = useMemo(() => {
    const term = search.trim().toLowerCase();

    return topics.filter((topic) => {
      if (statusFilter !== "all" && topic.status !== statusFilter) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        topic.meeting_summary,
        topic.title,
        topic.detail,
        topic.conclusion,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [topics, search, statusFilter]);

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

    return [...groups.values()];
  }, [filteredTopics]);

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
      toast.success("Topico removido da ata");
    } catch (deleteError) {
      toast.error((deleteError as Error).message || "Falha ao remover topico");
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
            Registro dos topicos de reuniao, independente da carga da Agenda.
          </p>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            void loadTopics();
          }}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por reuniao, titulo, detalhe ou conclusao"
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

      {loading ? (
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
                <Badge variant="outline">{group.topics.length} topico(s)</Badge>
              </div>

              <div className="space-y-2">
                {group.topics.map((topic) => (
                  <div key={topic.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{topic.title}</p>
                        {topic.detail && (
                          <p className="mt-1 text-xs text-muted-foreground">{topic.detail}</p>
                        )}
                        {topic.conclusion && (
                          <p className="mt-1 text-xs text-foreground/90">
                            <span className="font-semibold">Conclusao:</span> {topic.conclusion}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={topic.status}
                          onValueChange={(value) => {
                            void changeTopicStatus(topic.id, value as MeetingTopicStatus);
                          }}
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{STATUS_LABEL.pending}</SelectItem>
                            <SelectItem value="in_progress">{STATUS_LABEL.in_progress}</SelectItem>
                            <SelectItem value="resolved">{STATUS_LABEL.resolved}</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-danger hover:text-danger"
                          disabled={mutatingTopicId === topic.id}
                          onClick={() => {
                            void deleteTopic(topic.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
