import { useState, useEffect } from "react";
import { Loader2, Download } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { formatDuration, formatMoney } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

  useEffect(() => {
    if (user) loadData();
  }, [user, startDate, endDate]);

  async function loadData() {
    setLoading(true);
    const [sessRes, projRes] = await Promise.all([
      supabase
        .from("time_sessions")
        .select("*, project:projects(*)")
        .not("ended_at", "is", null)
        .gte("started_at", startDate)
        .lte("started_at", endDate + "T23:59:59")
        .order("started_at", { ascending: false }),
      supabase.from("projects").select("*"),
    ]);
    setSessions((sessRes.data || []) as any);
    setProjects((projRes.data || []) as unknown as Project[]);
    setLoading(false);
  }

  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const totalValue = sessions.reduce((acc, s) => {
    const rate = (s.project as any)?.hourly_rate || 0;
    return acc + ((s.duration_seconds || 0) / 3600) * rate;
  }, 0);

  // Chart data by project
  const chartData = projects
    .map((p) => {
      const projSessions = sessions.filter((s) => s.project_id === p.id);
      const hours = projSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 3600;
      return { name: p.name, hours: parseFloat(hours.toFixed(1)) };
    })
    .filter((d) => d.hours > 0);

  function exportCSV() {
    const bom = "\uFEFF";
    const header = "Data,Projeto,Cliente,Duracao,Valor\n";
    const rows = sessions
      .map((s) => {
        const proj = s.project as any;
        const date = new Date(s.started_at).toLocaleDateString("pt-BR");
        const duration = formatDuration(s.duration_seconds || 0);
        const value = formatMoney(((s.duration_seconds || 0) / 3600) * (proj?.hourly_rate || 0));
        return `${date},${proj?.name || ""},${proj?.client || ""},${duration},${value}`;
      })
      .join("\n");

    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workos-relatorio-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <LoadingState message="Carregando relatorios..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader className="flex-1" title="Relatorios" description="Analise de tempo e faturamento no periodo selecionado." />
        <Button onClick={exportCSV} variant="outline" className="border-border text-foreground">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data inicio</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-card border-border w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data fim</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-card border-border w-40" />
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Horas Totais</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary">
            {(totalSeconds / 3600).toFixed(1)}h
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor Total</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-success">
            {formatMoney(totalValue)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Horas por Projeto</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }} width={30} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(240 4% 10%)", border: "1px solid hsl(240 4% 16%)", borderRadius: "8px", color: "hsl(0 0% 98%)", fontSize: "12px" }}
                formatter={(value: number) => [`${value}h`, "Horas"]}
              />
              <Bar dataKey="hours" fill="hsl(262 83% 66%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sessions Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Sessoes ({sessions.length})</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">Relatorio</p>
            <p className="text-sm text-muted-foreground">Nenhuma sessao no periodo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="px-5 py-2 text-xs font-medium text-muted-foreground">Projeto</th>
                  <th className="px-5 py-2 text-xs font-medium text-muted-foreground">Cliente</th>
                  <th className="px-5 py-2 text-xs font-medium text-muted-foreground text-right">Duracao</th>
                  <th className="px-5 py-2 text-xs font-medium text-muted-foreground text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.slice(0, 50).map((s) => {
                  const proj = s.project as any;
                  return (
                    <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3 text-xs text-foreground">{proj?.name || "-"}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{proj?.client || "-"}</td>
                      <td className="px-5 py-3 text-xs font-mono tabular-nums text-foreground text-right">
                        {formatDuration(s.duration_seconds || 0)}
                      </td>
                      <td className="px-5 py-3 text-xs font-mono tabular-nums text-success text-right">
                        {formatMoney(((s.duration_seconds || 0) / 3600) * (proj?.hourly_rate || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}





