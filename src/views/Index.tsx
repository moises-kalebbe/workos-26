import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Building2,
  CalendarClock,
  ExternalLink,
  Landmark,
  Loader2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { DailyReflectionEditor } from "@/components/evolucao/daily-reflection-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/system/page-header";
import { useEvolucaoFeature } from "@/features/evolucao/hooks";
import { db } from "@/lib/dbClient";
import { summarizeFinanceiro } from "@/features/financeiro/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { getQuadrant, sortTasksForMatrix } from "@/lib/eisenhower";
import {
  buildTimelineBlocks,
  buildTimelineHourLabels,
  getCurrentMinuteMarker,
  getDateKeyInTimezone,
  getSessionOverlapSecondsForDate,
} from "@/lib/timeline";
import { cn, formatDuration, formatMoney } from "@/lib/utils";
import { KANBAN_PRIORITIES } from "@/config/priorities";
import type { FinancialEntry, Project, Task } from "@/types";

type DashboardSessionRow = {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  project: Pick<Project, "name" | "client" | "hourly_rate" | "color"> | null;
};

type DashboardTaskRow = Pick<
  Task,
  | "id"
  | "title"
  | "project_id"
  | "skill_document_id"
  | "column_index"
  | "priority"
  | "urgency"
  | "importance"
  | "due_date"
  | "client"
  | "created_at"
>;

type DashboardFinancialEntry = FinancialEntry & {
  project?: Pick<Project, "id" | "name" | "client" | "color"> | null;
};

const MOTIVATIONAL_PHRASES = {
  overdue: [
    "Ajuste a primeira pendencia e o resto do dia respira melhor.",
    "O atraso diminui quando voce fecha a proxima entrega certa.",
    "Voltar para o controle comeca por uma prioridade resolvida.",
  ],
  focus: [
    "Menos frentes abertas, mais resultado visivel.",
    "Foco curto e consistente entrega mais que correria espalhada.",
    "Uma tarefa bem fechada vale mais que varias pela metade.",
  ],
  meeting: [
    "Entre na proxima reuniao com clareza sobre a sua entrega principal.",
    "Reuniao boa comeca antes, com a prioridade do dia definida.",
    "Organize o proximo passo antes da call e ganhe o resto do dia.",
  ],
  default: [
    "Constancia curta e bem feita ganha do excesso.",
    "Seu melhor ritmo hoje e terminar o que realmente importa.",
    "Prioridade clara transforma um dia cheio em um dia produtivo.",
  ],
} as const;

export default function IndexPage() {
  const { user } = useAuth();
  const {
    events: calendarEvents,
    loading: meetingsLoading,
    connected: meetingsConnected,
    fetchEvents,
  } = useGoogleCalendar();
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionRow[]>([]);
  const [tasks, setTasks] = useState<DashboardTaskRow[]>([]);
  const [financialEntries, setFinancialEntries] = useState<DashboardFinancialEntry[]>([]);
  const [now, setNow] = useState(() => new Date());
  const dailyReflection = useEvolucaoFeature({ userId: user?.id || null });

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const timeMin = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();
    void fetchEvents(timeMin, timeMax);
  }, [fetchEvents, now, user]);

  async function loadDashboardData() {
    if (!user) return;
    setLoading(true);

    const recentWindowIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

    const [profileRes, projectRes, taskRes, sessionRes, financialRes] = await Promise.all([
      db.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
      db.from("projects").select("*").order("name"),
      db.from("tasks").select("id, title, project_id, skill_document_id, column_index, priority, urgency, importance, due_date, client, created_at").lt("column_index", 2).order("position"),
      db
        .from("time_sessions")
        .select("id, project_id, started_at, ended_at, project:projects(name, client, hourly_rate, color)")
        .gte("started_at", recentWindowIso)
        .order("started_at", { ascending: false })
        .limit(250),
      db.from("financial_entries").select("*").order("due_date", { ascending: true }),
    ]);

    if (profileRes.error) {
      toast.error("Nao foi possivel carregar o timezone do perfil.");
    } else if (profileRes.data?.timezone) {
      setTimezone(profileRes.data.timezone);
    }

    if (projectRes.error) {
      toast.error("Nao foi possivel carregar as empresas.");
    } else {
      setProjects((projectRes.data || []) as unknown as Project[]);
    }

    if (taskRes.error) {
      toast.error("Nao foi possivel carregar as tarefas do Kanban.");
    } else {
      setTasks((taskRes.data || []) as unknown as DashboardTaskRow[]);
    }

    if (sessionRes.error) {
      toast.error("Nao foi possivel carregar a linha do tempo.");
    } else {
      setSessions((sessionRes.data || []) as unknown as DashboardSessionRow[]);
    }

    if (financialRes.error) {
      toast.error("Nao foi possivel carregar o resumo financeiro.");
    } else {
      setFinancialEntries((financialRes.data || []) as DashboardFinancialEntry[]);
    }

    setLoading(false);
  }

  const timelineBlocks = useMemo(() => {
    return buildTimelineBlocks(
      sessions.map((session) => ({
        id: session.id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        projectName: session.project?.name || "Projeto sem nome",
        companyName: session.project?.client || null,
        hourlyRate: Number(session.project?.hourly_rate || 0),
        color: session.project?.color || null,
      })),
      timezone,
      now,
    );
  }, [now, sessions, timezone]);

  const timelineHourLabels = useMemo(() => buildTimelineHourLabels(3), []);
  const currentMinuteMarker = useMemo(() => getCurrentMinuteMarker(timezone, now), [now, timezone]);

  const projectsWithTodayStats = useMemo(() => {
    const todayKey = getDateKeyInTimezone(now, timezone);
    const secondsByProject = new Map<string, number>();

    sessions.forEach((session) => {
      const overlapSeconds = getSessionOverlapSecondsForDate(
        session.started_at,
        session.ended_at,
        timezone,
        todayKey,
        now,
      );

      if (overlapSeconds <= 0) return;
      secondsByProject.set(
        session.project_id,
        (secondsByProject.get(session.project_id) || 0) + overlapSeconds,
      );
    });

    return projects
      .map((project) => {
        const trackedSeconds = secondsByProject.get(project.id) || 0;
        return {
          ...project,
          trackedSeconds,
          estimatedValue: (trackedSeconds / 3600) * Number(project.hourly_rate || 0),
        };
      })
      .sort((a, b) => {
        if (a.trackedSeconds !== b.trackedSeconds) return b.trackedSeconds - a.trackedSeconds;
        return a.name.localeCompare(b.name);
      });
  }, [now, projects, sessions, timezone]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const financialMetrics = useMemo(() => {
    const entriesWithProjects = financialEntries.map((entry) => ({
      ...entry,
      project: entry.project_id ? projectMap.get(entry.project_id) || null : null,
    }));

    return summarizeFinanceiro(entriesWithProjects, now);
  }, [financialEntries, now, projectMap]);

  const kanbanFocus = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = sortTasksForMatrix(
      tasks.map((task) => {
        const dueTime = task.due_date ? new Date(task.due_date).getTime() : null;
        const dueDate = dueTime ? new Date(task.due_date as string) : null;
        const dayDiff =
          dueDate === null
            ? null
            : Math.floor((new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime() - today.getTime()) / 86400000);

        return {
          ...task,
          projectName: task.project_id ? projectMap.get(task.project_id)?.name || task.client || "Conhecimento geral" : task.client || "Conhecimento geral",
          dueTime,
          dayDiff,
          quadrant: getQuadrant(task),
        };
      })
    );

    const timeline = enriched.slice(0, 6).map((task, index) => {
      const priority = KANBAN_PRIORITIES.find((item) => item.value === task.priority);
      let dueLabel = "Sem prazo";
      let dueTone = "text-muted-foreground";

      if (task.dayDiff !== null) {
        if (task.dayDiff < 0) {
          dueLabel = `Atrasada ${Math.abs(task.dayDiff)}d`;
          dueTone = "text-danger";
        } else if (task.dayDiff === 0) {
          dueLabel = "Prazo hoje";
          dueTone = "text-warning";
        } else if (task.dayDiff === 1) {
          dueLabel = "Prazo amanha";
        } else {
          dueLabel = `Prazo em ${task.dayDiff}d`;
        }
      }

      const stageLabel = task.column_index === 1 ? "Em andamento" : index === 0 ? "Agora" : index < 3 ? "Proximo" : "Depois";

      return {
        ...task,
        rank: index + 1,
        stageLabel,
        priorityLabel: priority?.label || "Normal",
        priorityClassName: priority?.className || "bg-secondary text-muted-foreground",
        dueLabel,
        dueTone,
      };
    });

    return {
      openCount: enriched.length,
      inProgressCount: enriched.filter((task) => task.column_index === 1).length,
      overdueCount: enriched.filter((task) => task.dayDiff !== null && task.dayDiff < 0).length,
      dueTodayCount: enriched.filter((task) => task.dayDiff === 0).length,
      timeline,
    };
  }, [projectMap, tasks]);

  const todayMeetings = useMemo(() => {
    const todayKey = getDateKeyInTimezone(now, timezone);

    return [...calendarEvents]
      .filter((event) => {
        if (event.selfResponseStatus === "declined") return false;
        return getDateKeyInTimezone(new Date(event.start), timezone) === todayKey;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [calendarEvents, now, timezone]);

  const dashboardSummary = useMemo(() => {
    const upcomingMeeting = todayMeetings.find((meeting) => {
      if (meeting.allDay) return true;
      return new Date(meeting.end).getTime() >= now.getTime();
    });

    const nextTask = kanbanFocus.timeline[0] || null;

    const meetingSummary = !meetingsConnected
      ? "Agenda nao conectada"
      : todayMeetings.length === 0
        ? "sem reunioes hoje"
        : upcomingMeeting
          ? upcomingMeeting.allDay
            ? "ha uma reuniao de dia inteiro"
            : `sua proxima reuniao e as ${new Date(upcomingMeeting.start).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
          : "as reunioes de hoje ja terminaram";

    const taskSummary =
      kanbanFocus.openCount === 0
        ? "nenhuma tarefa aberta"
        : `${kanbanFocus.openCount} tarefa${kanbanFocus.openCount > 1 ? "s" : ""} aberta${kanbanFocus.openCount > 1 ? "s" : ""}`;

    const dueSummary =
      kanbanFocus.overdueCount > 0
        ? `${kanbanFocus.overdueCount} atrasada${kanbanFocus.overdueCount > 1 ? "s" : ""}`
        : kanbanFocus.dueTodayCount > 0
          ? `${kanbanFocus.dueTodayCount} vence${kanbanFocus.dueTodayCount > 1 ? "m" : ""} hoje`
          : nextTask?.due_date
            ? `proximo prazo em ${new Date(nextTask.due_date).toLocaleDateString("pt-BR")}`
            : "sem prazo critico no momento";

    const phraseBucket =
      kanbanFocus.overdueCount > 0
        ? MOTIVATIONAL_PHRASES.overdue
        : kanbanFocus.inProgressCount > 2
          ? MOTIVATIONAL_PHRASES.focus
          : upcomingMeeting
            ? MOTIVATIONAL_PHRASES.meeting
            : MOTIVATIONAL_PHRASES.default;

    const phraseIndex =
      now.getFullYear() +
      now.getMonth() +
      now.getDate() +
      kanbanFocus.openCount +
      todayMeetings.length;

    const motivationalLine = phraseBucket[phraseIndex % phraseBucket.length];

    return {
      headline: `Hoje ${meetingSummary}, com ${taskSummary} e ${dueSummary}.`,
      motivationalLine,
      nextMeeting: upcomingMeeting,
      nextTask,
    };
  }, [kanbanFocus, meetingsConnected, now, todayMeetings]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel principal"
        description={dashboardSummary.headline}
      />

      <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Agenda de hoje</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Reuniões do dia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Atualiza com os compromissos do dia e já deixa o atalho para entrar na call.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/agenda">
              Abrir agenda
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-4">
          {meetingsLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !meetingsConnected ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Google Calendar nao conectado. Conecte na Agenda para ver as reunioes de hoje aqui.
            </div>
          ) : todayMeetings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Nenhuma reuniao para hoje.
            </div>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {todayMeetings.map((meeting) => {
                const meetingEnded = !meeting.allDay && new Date(meeting.end).getTime() < now.getTime();

                return (
                <div
                  key={meeting.id}
                  className={cn(
                    "rounded-xl border border-border bg-background/25 p-3",
                    meetingEnded && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          {meeting.allDay
                            ? "Dia inteiro"
                            : `${new Date(meeting.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${new Date(meeting.end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        </Badge>
                        <Badge variant="secondary" className={cn(meetingEnded && "bg-secondary text-muted-foreground")}>
                          {meetingEnded ? "Finalizada" : "Hoje"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{meeting.projectName || "Conhecimento geral"}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{meeting.summary}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>
                          {meetingEnded
                            ? "Reuniao encerrada"
                            : meeting.allDay
                            ? "Compromisso do dia"
                            : `Comeca ${new Date(meeting.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {meeting.meetLink && !meetingEnded ? (
                        <Button asChild size="sm" className="h-8 gap-2 px-3">
                          <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4" />
                            Entrar no Meet
                          </a>
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="outline" className="h-8 gap-2 px-3">
                        <a href={meeting.htmlLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          {meetingEnded ? "Ver no Google" : "Abrir no Google"}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Radar do dia</p>
                <h2 className="mt-1 text-2xl font-semibold text-foreground">Linha de execucao das tarefas abertas</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ordem sugerida baseada em prioridade, urgencia, importancia e prazo do Kanban.
                </p>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/kanban">
                  Abrir Kanban
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Abertas</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{kanbanFocus.openCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Em andamento</p>
                <p className="mt-2 text-2xl font-semibold text-info">{kanbanFocus.inProgressCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo hoje</p>
                <p className="mt-2 text-2xl font-semibold text-warning">{kanbanFocus.dueTodayCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Atrasadas</p>
                <p className="mt-2 text-2xl font-semibold text-danger">{kanbanFocus.overdueCount}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex h-28 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : kanbanFocus.timeline.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                Nenhuma tarefa aberta no Kanban. Quando voce criar tarefas, a ordem recomendada aparece aqui.
              </div>
            ) : (
              <div className="space-y-3">
                {kanbanFocus.timeline.map((task) => (
                  <div key={task.id} className="rounded-xl border border-border bg-background/25 p-4 transition-colors hover:border-primary/40">
                    <div className="flex flex-wrap items-start gap-3 md:flex-nowrap">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
                        {task.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {task.stageLabel}
                          </Badge>
                          <span className={cn("text-xs font-medium", task.dueTone)}>{task.dueLabel}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", task.priorityClassName)}>
                            {task.priorityLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-foreground">{task.title}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{task.projectName}</span>
                          <span>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString("pt-BR") : "Sem data definida"}
                          </span>
                          <span>
                            {task.quadrant === "do_now"
                              ? "Fazer agora"
                              : task.quadrant === "schedule"
                                ? "Agendar"
                                : task.quadrant === "delegate"
                                  ? "Delegar"
                                  : "Eliminar"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Resumo do dia</p>
              <p className="mt-2 text-sm text-foreground">{dashboardSummary.headline}</p>
              <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Frase do dia</p>
                <p className="mt-1 text-sm text-foreground">{dashboardSummary.motivationalLine}</p>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Proxima reuniao</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {dashboardSummary.nextMeeting
                      ? dashboardSummary.nextMeeting.allDay
                        ? `${dashboardSummary.nextMeeting.summary} · Dia inteiro`
                        : `${new Date(dashboardSummary.nextMeeting.start).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} · ${dashboardSummary.nextMeeting.summary}`
                      : "Sem reunioes pendentes hoje"}
                  </p>
                </div>

                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Proxima entrega</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {dashboardSummary.nextTask
                      ? `${dashboardSummary.nextTask.title} · ${dashboardSummary.nextTask.dueLabel}`
                      : "Nenhuma tarefa aberta no Kanban"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link href="/kanban">Abrir Kanban</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link href="/agenda">Abrir Agenda</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DailyReflectionEditor
        draft={dailyReflection.draft}
        loading={dailyReflection.loading}
        moodOptions={dailyReflection.moodOptions}
        onSave={dailyReflection.saveTodayEntry}
        onUpdateDraft={dailyReflection.updateDraft}
        prompt={dailyReflection.todayPrompt}
        ratingOptions={dailyReflection.ratingOptions}
        saving={dailyReflection.saving}
        footer={(
          <Button asChild variant="outline">
            <Link href="/evolucao">Abrir historico</Link>
          </Button>
        )}
      />

      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Financeiro</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Resumo financeiro do workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entradas, saidas e alertas de vencimento no mesmo painel operacional.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/financeiro">
              Abrir financeiro
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowUpCircle className="h-4 w-4 text-emerald-300" />
              <p className="text-[11px] uppercase tracking-wide">A receber</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(financialMetrics.receivableOpen)}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowDownCircle className="h-4 w-4 text-amber-300" />
              <p className="text-[11px] uppercase tracking-wide">A pagar</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(financialMetrics.payableOpen)}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-rose-300" />
              <p className="text-[11px] uppercase tracking-wide">Vencidos</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{financialMetrics.overdueCount}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Landmark className="h-4 w-4 text-primary" />
              <p className="text-[11px] uppercase tracking-wide">Proximos</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{financialMetrics.upcomingCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Linha do tempo de hoje</h2>
            <p className="text-xs text-muted-foreground">Sessoes por horario no timezone {timezone}</p>
          </div>
          <Badge variant="secondary">{timelineBlocks.length} sessoes</Badge>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : timelineBlocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Sem sessoes hoje ainda.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative ml-52 hidden h-4 text-[10px] text-muted-foreground md:block">
              {timelineHourLabels.map((hour) => (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}h
                </span>
              ))}
            </div>

            {timelineBlocks.map((block) => (
              <div key={block.id} className="grid gap-2 md:grid-cols-[200px_1fr] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{block.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {block.company || "Sem empresa"} · {formatDuration(block.durationSeconds)} ·{" "}
                    {formatMoney(block.estimatedValue)}
                  </p>
                </div>

                <div className="relative h-8 overflow-hidden rounded-md border border-border bg-background/40">
                  {timelineHourLabels.map((hour) => (
                    <span
                      key={hour}
                      className="absolute inset-y-0 w-px bg-border/70"
                      style={{ left: `${(hour / 24) * 100}%` }}
                    />
                  ))}

                  <span
                    className="absolute inset-y-0 w-px bg-primary/60"
                    style={{ left: `${(currentMinuteMarker / 1440) * 100}%` }}
                  />

                  <span
                    className={cn(
                      "absolute inset-y-1 rounded-sm",
                      block.isActive && "animate-pulse",
                    )}
                    style={{
                      left: `${block.leftPercent}%`,
                      width: `${block.widthPercent}%`,
                      backgroundColor: block.color || "hsl(var(--primary))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Empresas no painel</h2>
          </div>
          <Badge variant="secondary">{projectsWithTodayStats.length}</Badge>
        </div>

        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : projectsWithTodayStats.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Nenhuma empresa cadastrada. Crie em Configuracoes &gt; Empresas.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {projectsWithTodayStats.map((project) => (
              <Link
                key={project.id}
                href={`/settings?tab=companies&project=${project.id}`}
                className="rounded-lg border border-border bg-background/20 p-3 transition-colors hover:border-primary/40 hover:bg-background/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{project.client || "Sem cliente"}</p>
                  </div>
                  <span
                    className="mt-1 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: project.color || "hsl(var(--primary))" }}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Hoje: {formatDuration(project.trackedSeconds)} · {formatMoney(project.estimatedValue)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border/70 pt-4">
        <p className="text-center text-xs text-muted-foreground">
          Painel do dia atualizado com agenda, tarefas abertas e empresas em acompanhamento.
        </p>
      </footer>
    </div>
  );
}





