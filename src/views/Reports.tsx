import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarRange,
  Clock3,
  Download,
  FolderKanban,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { cn, formatDuration, formatMoney } from "@/lib/utils";
import type { Project, TimeSession } from "@/types";

type SessionWithProject = TimeSession & { project?: Project };

type ProjectReport = {
  id: string;
  name: string;
  client: string;
  hours: number;
  value: number;
  sessions: number;
};

type PeriodPreset = "7d" | "30d" | "month";

const CHART_COLORS = [
  "hsl(193 90% 52%)",
  "hsl(199 89% 48%)",
  "hsl(172 88% 45%)",
  "hsl(142 72% 45%)",
  "hsl(190 95% 43%)",
  "hsl(215 85% 62%)",
];

function toInputDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function buildPresetDates(preset: PeriodPreset) {
  const now = new Date();
  const end = toInputDate(now);

  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toInputDate(start), end };
  }

  const start = new Date(now);
  start.setDate(now.getDate() - (preset === "7d" ? 6 : 29));
  return { start: toInputDate(start), end };
}

function formatSessionDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ReportStatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Clock3;
  accent?: "default" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/95 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", accent === "success" ? "text-emerald-300" : "text-primary")} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const defaultPeriod = buildPresetDates("30d");
  const [sessions, setSessions] = useState<SessionWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(defaultPeriod.start);
  const [endDate, setEndDate] = useState(defaultPeriod.end);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [sessionsResponse, projectsResponse] = await Promise.all([
      db
        .from("time_sessions")
        .select("*, project:projects(*)")
        .not("ended_at", "is", null)
        .gte("started_at", startDate)
        .lte("started_at", `${endDate}T23:59:59`)
        .order("started_at", { ascending: false }),
      db.from("projects").select("*").order("name"),
    ]);

    setSessions((sessionsResponse.data || []) as SessionWithProject[]);
    setProjects((projectsResponse.data || []) as Project[]);
    setLoading(false);
  }, [endDate, startDate]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [loadData, user]);

  const projectReports = useMemo<ProjectReport[]>(() => {
    return projects
      .map((project) => {
        const projectSessions = sessions.filter((session) => session.project_id === project.id);
        const totalSeconds = projectSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
        const hours = totalSeconds / 3600;
        const value = projectSessions.reduce((sum, session) => {
          const rate = session.project?.hourly_rate || project.hourly_rate || 0;
          return sum + ((session.duration_seconds || 0) / 3600) * rate;
        }, 0);

        return {
          id: project.id,
          name: project.name,
          client: project.client || "Sem cliente",
          hours: Number(hours.toFixed(1)),
          value,
          sessions: projectSessions.length,
        };
      })
      .filter((item) => item.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [projects, sessions]);

  const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
  const totalHours = totalSeconds / 3600;
  const totalValue = sessions.reduce((sum, session) => {
    const rate = session.project?.hourly_rate || 0;
    return sum + ((session.duration_seconds || 0) / 3600) * rate;
  }, 0);
  const topProject = projectReports[0] || null;
  const secondProject = projectReports[1] || null;
  const visibleProjects = projectReports.slice(0, 6);
  const visibleSessions = sessions.slice(0, 12);
  const averageHoursPerSession = sessions.length > 0 ? totalHours / sessions.length : 0;

  function exportCSV() {
    const bom = "\uFEFF";
    const header = "Data,Projeto,Cliente,Duracao,Valor\n";
    const rows = sessions
      .map((session) => {
        const project = session.project;
        const date = new Date(session.started_at).toLocaleDateString("pt-BR");
        const duration = formatDuration(session.duration_seconds || 0);
        const value = formatMoney(((session.duration_seconds || 0) / 3600) * (project?.hourly_rate || 0));
        return `${date},${project?.name || ""},${project?.client || ""},${duration},${value}`;
      })
      .join("\n");

    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workos-relatorio-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function applyPreset(preset: PeriodPreset) {
    const nextDates = buildPresetDates(preset);
    setStartDate(nextDates.start);
    setEndDate(nextDates.end);
  }

  if (loading) {
    return <LoadingState message="Carregando relatórios..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          className="flex-1"
          title="Relatórios"
          description="Veja rapidamente onde seu tempo esta concentrado, quanto isso gera e quais sessões explicam o resultado."
        />

        <Button onClick={exportCSV} variant="outline" className="h-11 rounded-2xl border-border bg-background/60">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <section className="grid gap-3 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr]">
        <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(8,18,38,0.96),rgba(15,25,44,0.92))] p-5 shadow-[0_20px_60px_-40px_rgba(34,211,238,0.5)]">
          <div className="flex items-center gap-2 text-cyan-200/80">
            <Activity className="h-4 w-4 text-cyan-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Leitura do período</p>
          </div>

          <div className="mt-3">
            <p className="text-lg font-semibold text-foreground">
              {topProject ? topProject.name : "Nenhum projeto lider no período"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {topProject
                ? `${topProject.hours.toFixed(1)}h concentradas em ${topProject.client}. Esse foi o principal puxador de foco no recorte.`
                : "Ajuste o período ou registre sessões para destravar os indicadores desta área."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{totalHours.toFixed(1)}h</p>
              <p className="mt-1 text-sm text-emerald-300">{formatMoney(totalValue)}</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
                {sessions.length} sessões fechadas
              </span>
              <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
                {projectReports.length} projetos com horas
              </span>
              {secondProject ? (
                <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
                  Apoio: {secondProject.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <ReportStatCard
          label="Horas totais"
          value={`${totalHours.toFixed(1)}h`}
          helper={`${sessions.length} sessoes concluidas no periodo`}
          icon={Clock3}
        />

        <ReportStatCard
          label="Valor total"
          value={formatMoney(totalValue)}
          helper="Estimativa com base no valor/hora de cada projeto"
          icon={Wallet}
          accent="success"
        />

        <ReportStatCard
          label="Projetos ativos"
          value={String(projectReports.length).padStart(2, "0")}
          helper={`${averageHoursPerSession.toFixed(1)}h em media por sessao`}
          icon={FolderKanban}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card/95 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Filtro do relatório</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Refine o período e recalcule rápido</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "7 dias", value: "7d" as const },
              { label: "30 dias", value: "30d" as const },
              { label: "Mes atual", value: "month" as const },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset.value)}
                className="rounded-full border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_auto]">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Data inicio</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 rounded-2xl border-border bg-background/60"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Data fim</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 rounded-2xl border-border bg-background/60"
            />
          </div>

          <div className="flex items-end">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1 rounded-full bg-background/60 text-muted-foreground">
                <CalendarRange className="h-3 w-3" />
                {new Date(`${startDate}T00:00:00`).toLocaleDateString("pt-BR")} até {new Date(`${endDate}T00:00:00`).toLocaleDateString("pt-BR")}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Distribuicao de foco</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Horas por projeto</h2>
              <p className="mt-1 text-sm text-muted-foreground">Leitura rápida das frentes que mais consumiram tempo no período.</p>
            </div>
            <span className="rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              Top {Math.max(visibleProjects.length, 1)}
            </span>
          </div>

          <div className="mt-4">
            {visibleProjects.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Sem horas no período"
                description="Quando houver sessões fechadas, o gráfico mostra quais projetos estão puxando foco e valor."
              />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={visibleProjects} margin={{ top: 12, right: 8, left: -12, bottom: 0 }} barCategoryGap={18}>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(148,163,184,0.88)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(148,163,184,0.72)", fontSize: 11 }}
                    width={42}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                      background: "rgba(9, 15, 27, 0.94)",
                      border: "1px solid rgba(34,211,238,0.15)",
                      borderRadius: "14px",
                      color: "#f8fafc",
                    }}
                    formatter={(value: number, _name, item) => [
                      `${Number(value).toFixed(1)}h | ${formatMoney(item.payload.value)}`,
                      item.payload.client,
                    ]}
                    labelFormatter={(label) => `Projeto: ${label}`}
                  />
                  <Bar dataKey="hours" radius={[12, 12, 6, 6]}>
                    {visibleProjects.map((entry, index) => (
                      <Cell key={entry.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Resumo de projetos</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Ranking do período</h2>
            <p className="mt-1 text-sm text-muted-foreground">Área de leitura rápida para decidir onde manter energia.</p>
          </div>

          <div className="mt-4 space-y-3">
            {projectReports.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="Nenhum projeto com horas"
                description="Assim que houver sessões no período selecionado, o ranking mostra as frentes mais relevantes."
              />
            ) : (
              projectReports.slice(0, 5).map((project, index) => (
                <div key={project.id} className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          0{index + 1}
                        </span>
                        <p className="truncate font-medium text-foreground">{project.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{project.client}</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full bg-background/70 text-muted-foreground">
                      {project.sessions} sess.
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono tabular-nums text-foreground">{project.hours.toFixed(1)}h</span>
                    <span className="font-mono tabular-nums text-emerald-300">{formatMoney(project.value)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/95">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Histórico recente</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Sessões que explicam os números</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <ReceiptText className="h-3.5 w-3.5 text-primary" />
            {sessions.length} sessões encontradas
          </div>
        </div>

        {visibleSessions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ReceiptText}
              title="Nenhuma sessão no período"
              description="Ajuste o período ou registre novas sessões para ver o histórico recente nesta área."
            />
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {visibleSessions.map((session) => {
              const project = session.project;
              const durationSeconds = session.duration_seconds || 0;
              const value = (durationSeconds / 3600) * (project?.hourly_rate || 0);

              return (
                <div
                  key={session.id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-[minmax(0,1.2fr)_150px_150px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">{project?.name || "Projeto não identificado"}</p>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                        {project?.client || "Sem cliente"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{formatSessionDate(session.started_at)}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:hidden">Duracao</span>
                    <span className="font-mono text-sm tabular-nums text-foreground">{formatDuration(durationSeconds)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:hidden">Valor</span>
                    <span className="font-mono text-sm tabular-nums text-emerald-300">{formatMoney(value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
