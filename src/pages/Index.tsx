import { useEffect, useState } from "react";
import { Timer, DollarSign, Briefcase, Loader2, Clock, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatMoney, formatHours } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Project, Task } from "@/types";

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hoursToday, setHoursToday] = useState(0);
  const [totalBilled, setTotalBilled] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; hours: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [projectsRes, tasksRes, sessionsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(5),
      supabase.from("tasks").select("*").order("position"),
      supabase.from("time_sessions").select("*, project:projects(*)").not("ended_at", "is", null).order("started_at", { ascending: false }),
    ]);

    const allProjects = (projectsRes.data || []) as unknown as Project[];
    const allTasks = (tasksRes.data || []) as unknown as Task[];
    const allSessions = sessionsRes.data || [];

    setProjects(allProjects);
    setTasks(allTasks);

    // Hours today
    const todaySessions = allSessions.filter(
      (s: any) => new Date(s.started_at) >= today
    );
    const todaySeconds = todaySessions.reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);
    setHoursToday(todaySeconds);

    // Total billed
    const total = allSessions.reduce((acc: number, s: any) => {
      const rate = s.project?.hourly_rate || 0;
      const hours = (s.duration_seconds || 0) / 3600;
      return acc + hours * rate;
    }, 0);
    setTotalBilled(total);

    // Weekly chart
    const days: { day: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const daySeconds = allSessions
        .filter((s: any) => {
          const started = new Date(s.started_at);
          return started >= d && started < next;
        })
        .reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);

      days.push({
        day: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        hours: parseFloat((daySeconds / 3600).toFixed(1)),
      });
    }
    setWeeklyData(days);
    setLoading(false);
  }

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const inProgress = tasks.filter((t) => t.column_index === 1).length;
  const toDo = tasks.filter((t) => t.column_index === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu trabalho</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Horas Hoje" value={formatHours(hoursToday)} icon={Timer} color="brand" />
        <StatCard title="Total Faturado" value={formatMoney(totalBilled)} icon={DollarSign} color="success" />
        <StatCard title="Projetos Ativos" value={String(activeProjects)} icon={Briefcase} color="info" />
        <StatCard title="Em Andamento" value={String(inProgress)} icon={ArrowUpRight} color="warning" />
        <StatCard title="A Fazer" value={String(toDo)} icon={Clock} color="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Projetos Recentes</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📁</p>
              <p className="text-sm text-muted-foreground">Nenhum projeto ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-muted-foreground/20"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.client || "Sem cliente"}</p>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatMoney(project.hourly_rate)}/h
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Hours Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Horas por Dia</h2>
          {weeklyData.every((d) => d.hours === 0) ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm text-muted-foreground">Sem dados esta semana</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(240 4% 10%)",
                    border: "1px solid hsl(240 4% 16%)",
                    borderRadius: "8px",
                    color: "hsl(0 0% 98%)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}h`, "Horas"]}
                />
                <Bar dataKey="hours" fill="hsl(262 83% 66%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* In Progress Tasks */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Tarefas Em Andamento</h2>
        {tasks.filter((t) => t.column_index === 1).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm text-muted-foreground">Nenhuma tarefa em andamento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks
              .filter((t) => t.column_index === 1)
              .slice(0, 5)
              .map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-info" />
                    <p className="text-sm text-foreground">{task.title}</p>
                  </div>
                  {task.client && (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {task.client}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
