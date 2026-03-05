import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  Calendar,
  Clock3,
  Columns3,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  CircleDollarSign,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  buildTimelineBlocks,
  buildTimelineHourLabels,
  getCurrentMinuteMarker,
  getDateKeyInTimezone,
  getSessionOverlapSecondsForDate,
} from "@/lib/timeline";
import { cn, formatDuration, formatMoney } from "@/lib/utils";
import type { Project } from "@/types";

type DashboardSessionRow = {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  project: Pick<Project, "name" | "client" | "hourly_rate" | "color"> | null;
};

const shortcuts = [
  {
    label: "Second Brain",
    path: "/second-brain",
    icon: BrainCircuit,
    description: "Capture notas, conecte ideias e transforme em acao.",
  },
  {
    label: "Time Tracker",
    path: "/tracker",
    icon: Timer,
    description: "Registre sessoes de trabalho e valor gerado.",
  },
  {
    label: "Kanban",
    path: "/kanban",
    icon: Columns3,
    description: "Priorize tarefas por urgencia e importancia.",
  },
  {
    label: "Agenda",
    path: "/agenda",
    icon: Calendar,
    description: "Organize compromissos e reunioes da semana.",
  },
  {
    label: "Cofre",
    path: "/vault",
    icon: Lock,
    description: "Acesse credenciais por empresa com seguranca.",
  },
];

export default function IndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionRow[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function loadDashboardData() {
    if (!user) return;
    setLoading(true);

    try {
      const recentWindowIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

      const [profileRes, projectRes, sessionRes] = await Promise.all([
        supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
        supabase.from("projects").select("*").order("name"),
        supabase
          .from("time_sessions")
          .select("id, project_id, started_at, ended_at, project:projects(name, client, hourly_rate, color)")
          .gte("started_at", recentWindowIso)
          .order("started_at", { ascending: false })
          .limit(250),
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

      if (sessionRes.error) {
        toast.error("Nao foi possivel carregar a linha do tempo.");
      } else {
        setSessions((sessionRes.data || []) as unknown as DashboardSessionRow[]);
      }
    } catch {
      toast.error("Falha de conexao ao carregar o painel.");
      setProjects([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
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

  const todayTrackedSeconds = useMemo(
    () => projectsWithTodayStats.reduce((acc, project) => acc + project.trackedSeconds, 0),
    [projectsWithTodayStats],
  );

  const todayEstimatedValue = useMemo(
    () => projectsWithTodayStats.reduce((acc, project) => acc + project.estimatedValue, 0),
    [projectsWithTodayStats],
  );

  const activeSessionsCount = useMemo(
    () => timelineBlocks.filter((block) => block.isActive).length,
    [timelineBlocks],
  );

  const averageSessionSeconds = useMemo(() => {
    if (timelineBlocks.length === 0) return 0;
    const total = timelineBlocks.reduce((acc, block) => acc + block.durationSeconds, 0);
    return Math.round(total / timelineBlocks.length);
  }, [timelineBlocks]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Visao Geral"
        icon={LayoutDashboard}
        title="Painel principal"
        description="Resumo de operacao do dia com atalhos, progresso de horas e leitura rapida de atividade por empresa."
        actions={(
          <Button asChild className="gap-2">
            <Link href="/second-brain">
              Abrir Second Brain
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Horas de hoje"
          value={formatDuration(todayTrackedSeconds)}
          subtitle={`${projectsWithTodayStats.length} empresa(s) com atividade`}
          icon={Clock3}
          color="brand"
        />
        <StatCard
          title="Valor estimado"
          value={formatMoney(todayEstimatedValue)}
          subtitle="Projecao baseada nas horas registradas"
          icon={CircleDollarSign}
          color="success"
        />
        <StatCard
          title="Sessoes ativas"
          value={String(activeSessionsCount)}
          subtitle="Atualizado em tempo real"
          icon={ListChecks}
          color={activeSessionsCount > 0 ? "warning" : "info"}
        />
        <StatCard
          title="Media por sessao"
          value={formatDuration(averageSessionSeconds)}
          subtitle={`${timelineBlocks.length} sessao(oes) no dia`}
          icon={Timer}
          color="info"
        />
      </div>

      <SectionCard
        title="Atalhos rapidos"
        subtitle="Acesse os modulos mais usados com um clique."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.path}
              href={shortcut.path}
              className="group rounded-xl border border-border/80 bg-background/55 p-4 transition-colors hover:border-primary/45 hover:bg-background/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{shortcut.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{shortcut.description}</p>
                </div>
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card/70 text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                  <shortcut.icon className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Linha do tempo de hoje"
        subtitle={`Distribuicao de sessoes por horario no timezone ${timezone}.`}
        actions={<Badge variant="secondary">{timelineBlocks.length} sessao(oes)</Badge>}
      >
        {loading ? (
          <div className="flex h-28 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : timelineBlocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Sem sessoes registradas hoje. Inicie o tracker para acompanhar sua timeline.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative ml-[268px] hidden h-4 text-xs text-muted-foreground lg:block">
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
              <div key={block.id} className="grid gap-3 lg:grid-cols-[260px_1fr] lg:items-center lg:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{block.label}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {block.company || "Sem empresa"} - {formatDuration(block.durationSeconds)} -{" "}
                    {formatMoney(block.estimatedValue)}
                  </p>
                </div>

                <div className="relative h-9 overflow-hidden rounded-md border border-border/80 bg-background/55">
                  {timelineHourLabels.map((hour) => (
                    <span
                      key={hour}
                      className="absolute inset-y-0 w-px bg-border/75"
                      style={{ left: `${(hour / 24) * 100}%` }}
                    />
                  ))}

                  <span
                    className="absolute inset-y-0 w-px bg-primary/75"
                    style={{ left: `${(currentMinuteMarker / 1440) * 100}%` }}
                  />

                  <span
                    className={cn(
                      "absolute inset-y-1.5 rounded-sm",
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
      </SectionCard>

      <SectionCard
        title="Empresas com atividade"
        subtitle="Ranking do dia por tempo dedicado e valor estimado."
        actions={(
          <Badge variant="secondary" className="gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {projectsWithTodayStats.length}
          </Badge>
        )}
      >
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : projectsWithTodayStats.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma empresa cadastrada. Crie em Configuracoes e comece a registrar horas.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projectsWithTodayStats.slice(0, 9).map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-border/80 bg-background/55 p-3.5 transition-colors hover:border-primary/35"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{project.client || "Sem cliente"}</p>
                  </div>
                  <span
                    className="mt-1 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: project.color || "hsl(var(--primary))" }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border/70 bg-card/65 px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">Tempo</p>
                    <p className="font-mono font-semibold text-foreground tabular-nums">
                      {formatDuration(project.trackedSeconds)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-card/65 px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-mono font-semibold text-success tabular-nums">
                      {formatMoney(project.estimatedValue)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
