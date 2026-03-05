import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, BarChart3, Clock3, CircleDollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { FilterBar } from "@/components/system/filter-bar";
import { SectionCard } from "@/components/system/section-card";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatDuration, formatMoney } from "@/lib/utils";
import type { Project, TimeSession } from "@/types";

export default function ReportsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<(TimeSession & { project?: Project })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sessRes, projRes] = await Promise.all([
      supabase
        .from("time_sessions")
        .select("*, project:projects(*)")
        .not("ended_at", "is", null)
        .gte("started_at", startDate)
        .lte("started_at", `${endDate}T23:59:59`)
        .order("started_at", { ascending: false }),
      supabase.from("projects").select("*"),
    ]);
    setSessions((sessRes.data || []) as any);
    setProjects((projRes.data || []) as unknown as Project[]);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  const totalSeconds = useMemo(
    () => sessions.reduce((acc, session) => acc + (session.duration_seconds || 0), 0),
    [sessions],
  );
  const totalValue = useMemo(
    () =>
      sessions.reduce((acc, session) => {
        const rate = (session.project as any)?.hourly_rate || 0;
        return acc + ((session.duration_seconds || 0) / 3600) * rate;
      }, 0),
    [sessions],
  );

  const chartData = useMemo(
    () =>
      projects
        .map((project) => {
          const projectSessions = sessions.filter((session) => session.project_id === project.id);
          const hours = projectSessions.reduce((acc, session) => acc + (session.duration_seconds || 0), 0) / 3600;
          return { name: project.name, hours: Number(hours.toFixed(1)) };
        })
        .filter((item) => item.hours > 0),
    [projects, sessions],
  );

  function exportCSV() {
    const bom = "\uFEFF";
    const header = "Data,Projeto,Cliente,Duracao,Valor\n";
    const rows = sessions
      .map((session) => {
        const project = session.project as any;
        const date = new Date(session.started_at).toLocaleDateString("pt-BR");
        const duration = formatDuration(session.duration_seconds || 0);
        const value = formatMoney(((session.duration_seconds || 0) / 3600) * (project?.hourly_rate || 0));
        return `${date},${project?.name || ""},${project?.client || ""},${duration},${value}`;
      })
      .join("\n");

    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workos-relatorio-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <LoadingState message="Carregando relatorios..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        icon={BarChart3}
        title="Relatorios"
        description="Analise de horas e faturamento por periodo com exportacao em CSV."
        actions={(
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      />

      <FilterBar>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data inicio</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full bg-background md:w-44"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data fim</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full bg-background md:w-44"
          />
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="Horas totais"
          value={`${(totalSeconds / 3600).toFixed(1)}h`}
          subtitle={`${sessions.length} sessao(oes) no periodo`}
          icon={Clock3}
          color="brand"
        />
        <StatCard
          title="Valor total"
          value={formatMoney(totalValue)}
          subtitle="Estimativa calculada por taxa/hora"
          icon={CircleDollarSign}
          color="success"
        />
      </div>

      {chartData.length > 0 ? (
        <SectionCard title="Horas por projeto" subtitle="Distribuicao de horas registradas por empresa.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(214 18% 69%)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(214 18% 69%)", fontSize: 12 }} width={36} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220 40% 12%)",
                  border: "1px solid hsl(216 21% 24%)",
                  borderRadius: "10px",
                  color: "hsl(210 40% 96%)",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value}h`, "Horas"]}
              />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Sessoes (${sessions.length})`}
        subtitle="Historico detalhado das ultimas sessoes no periodo selecionado."
      >
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma sessao encontrada no periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[680px] w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Data</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Projeto</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cliente</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground text-right">Duracao</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {sessions.slice(0, 80).map((session) => {
                  const project = session.project as any;
                  return (
                    <tr key={session.id} className="transition-colors hover:bg-secondary/35">
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(session.started_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{project?.name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{project?.client || "-"}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                        {formatDuration(session.duration_seconds || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-success">
                        {formatMoney(((session.duration_seconds || 0) / 3600) * (project?.hourly_rate || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
