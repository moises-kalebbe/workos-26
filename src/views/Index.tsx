import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BrainCircuit, Building2, Calendar, Columns3, Loader2, Lock, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/system/page-header";
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
  { label: "Second Brain", path: "/second-brain", icon: BrainCircuit, description: "Capture notas e conecte ideias." },
  { label: "Time Tracker", path: "/tracker", icon: Timer, description: "Registre sessoes de trabalho." },
  { label: "Kanban", path: "/kanban", icon: Columns3, description: "Priorize tarefas por coluna." },
  { label: "Agenda", path: "/agenda", icon: Calendar, description: "Visualize compromissos do dia." },
  { label: "Cofre", path: "/vault", icon: Lock, description: "Gerencie credenciais por cliente." },
];

export default function IndexPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionRow[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadDashboardData() {
    if (!user) return;
    setLoading(true);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel principal"
        description="Escolha um modulo para continuar. Timeline e empresas em acompanhamento rapido do dia."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.path}
            href={shortcut.path}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{shortcut.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{shortcut.description}</p>
              </div>
              <shortcut.icon className="h-4 w-4 text-primary" />
            </div>
          </Link>
        ))}
      </div>

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
              <div key={project.id} className="rounded-lg border border-border bg-background/20 p-3">
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
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex">
        <Button asChild className="gap-2">
          <Link href="/second-brain">
            Abrir Second Brain
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}





