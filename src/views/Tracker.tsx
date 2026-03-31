import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { cn, formatDuration, formatMoney } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/projectColors";
import { toast } from "sonner";
import type { Project, TimeSession } from "@/types";

type ProjectFilter = "all" | "today" | "idle";

type ProjectAnalytics = {
  project: Project;
  sessions: TimeSession[];
  todaySeconds: number;
  totalSeconds: number;
  todayValue: number;
  totalValue: number;
  lastSessionAt: string | null;
  isActive: boolean;
};

function isSameDay(date: Date, now: Date) {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatShortDuration(seconds: number) {
  if (seconds <= 0) return "0 min";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${Math.max(minutes, 1)} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function formatSessionMoment(iso: string | null) {
  if (!iso) return "Sem sessoes";

  const date = new Date(iso);
  const now = new Date();
  const dateLabel = isSameDay(date, now)
    ? "Hoje"
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const timeLabel = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} as ${timeLabel}`;
}

export default function TrackerPage() {
  const { user, loading: authLoading } = useAuth();
  const timer = useTimer();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");

  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");

  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editColor, setEditColor] = useState("#8b5cf6");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProjects([]);
      setSessions([]);
      setLoading(false);
      return;
    }

    void loadData();
  }, [authLoading, user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      const [projRes, sessRes] = await Promise.all([
        db.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        db
          .from("time_sessions")
          .select("*")
          .eq("user_id", user.id)
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false }),
      ]);

      if (projRes.error) throw projRes.error;
      if (sessRes.error) throw sessRes.error;

      setProjects((projRes.data || []) as unknown as Project[]);
      setSessions((sessRes.data || []) as unknown as TimeSession[]);
    } catch (error) {
      console.error("Erro ao carregar tracker", error);
      toast.error("Nao foi possivel carregar projetos e sessoes.");
      setProjects([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newName || !user) return;

    const { error } = await db.from("projects").insert({
      user_id: user.id,
      name: newName,
      client: newClient || null,
      hourly_rate: parseFloat(newRate) || 0,
      color: newColor,
    });

    if (error) {
      toast.error("Erro ao criar projeto");
    } else {
      toast.success("Projeto criado!");
      setDialogOpen(false);
      setNewName("");
      setNewClient("");
      setNewRate("");
      await loadData();
    }
  }

  async function updateProject() {
    if (!editingProject || !editName) return;

    const { error } = await db.from("projects").update({
      name: editName,
      client: editClient || null,
      hourly_rate: parseFloat(editRate) || 0,
      color: editColor,
    }).eq("id", editingProject.id);

    if (error) {
      toast.error("Erro ao atualizar projeto");
    } else {
      toast.success("Projeto atualizado!");
      setEditDialogOpen(false);
      setEditingProject(null);
      await loadData();
    }
  }

  async function deleteProject(projectId: string) {
    await db.from("time_sessions").delete().eq("project_id", projectId);
    const { error } = await db.from("projects").delete().eq("id", projectId);

    if (error) {
      toast.error("Erro ao excluir projeto");
    } else {
      toast.success("Projeto excluido!");
      await loadData();
    }
  }

  async function deleteSession(sessionId: string) {
    const { error } = await db.from("time_sessions").delete().eq("id", sessionId);

    if (error) {
      toast.error("Erro ao excluir sessao");
    } else {
      toast.success("Sessao excluida!");
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    }
  }

  function openEditDialog(project: Project) {
    setEditingProject(project);
    setEditName(project.name);
    setEditClient(project.client || "");
    setEditRate(String(project.hourly_rate));
    setEditColor(project.color);
    setEditDialogOpen(true);
  }

  async function handleStart(projectId: string) {
    if (!user) return;

    await timer.start(projectId, user.id);
    await loadData();
    toast.success("Timer iniciado!");
  }

  async function handleStop() {
    await timer.stop();
    await loadData();
    toast.success("Timer finalizado!");
  }

  const activeProject = useMemo(
    () => projects.find((project) => project.id === timer.activeProjectId) || null,
    [projects, timer.activeProjectId],
  );

  const projectAnalytics = useMemo<ProjectAnalytics[]>(() => {
    const now = new Date();

    return projects
      .map((project) => {
        const projectSessions = sessions.filter((session) => session.project_id === project.id);
        const todaySeconds = projectSessions.reduce((sum, session) => {
          const startedAt = new Date(session.started_at);
          if (!isSameDay(startedAt, now)) return sum;
          return sum + (session.duration_seconds || 0);
        }, 0);

        const totalSeconds = projectSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
        const lastSessionAt = projectSessions[0]?.started_at || null;

        return {
          project,
          sessions: projectSessions,
          todaySeconds,
          totalSeconds,
          todayValue: (todaySeconds / 3600) * project.hourly_rate,
          totalValue: (totalSeconds / 3600) * project.hourly_rate,
          lastSessionAt,
          isActive: timer.activeProjectId === project.id,
        };
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.todaySeconds !== b.todaySeconds) return b.todaySeconds - a.todaySeconds;
        if (a.totalSeconds !== b.totalSeconds) return b.totalSeconds - a.totalSeconds;
        return a.project.name.localeCompare(b.project.name);
      });
  }, [projects, sessions, timer.activeProjectId]);

  const trackerSummary = useMemo(() => {
    const todaySeconds = projectAnalytics.reduce((sum, item) => sum + item.todaySeconds, 0);
    const todayValue = projectAnalytics.reduce((sum, item) => sum + item.todayValue, 0);
    const workedTodayCount = projectAnalytics.filter((item) => item.todaySeconds > 0).length;
    const topProjectToday = [...projectAnalytics].sort((a, b) => b.todaySeconds - a.todaySeconds)[0] || null;

    return {
      todaySeconds,
      todayValue,
      workedTodayCount,
      topProjectToday,
    };
  }, [projectAnalytics]);

  const filteredAnalytics = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return projectAnalytics.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.project.name.toLowerCase().includes(normalizedSearch) ||
        (item.project.client || "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;
      if (filter === "today") return item.todaySeconds > 0 || item.isActive;
      if (filter === "idle") return item.todaySeconds === 0 && !item.isActive;
      return true;
    });
  }, [filter, projectAnalytics, searchQuery]);

  const activeAnalytics = filteredAnalytics.find((item) => item.isActive) || null;
  const workedTodayProjects = filteredAnalytics.filter((item) => !item.isActive && item.todaySeconds > 0);
  const idleProjects = filteredAnalytics.filter((item) => !item.isActive && item.todaySeconds === 0);

  function renderProjectForm(
    name: string,
    setName: (value: string) => void,
    client: string,
    setClient: (value: string) => void,
    rate: string,
    setRate: (value: string) => void,
    color: string,
    setColor: (value: string) => void,
    onSubmit: () => void,
    buttonLabel: string,
  ) {
    return (
      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Nome do projeto</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Website Redesign" className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Ex: Empresa X" className="bg-background border-border" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">R$/hora</Label>
            <Input type="number" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="150" className="bg-background border-border font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((projectColor) => (
                <button
                  key={projectColor}
                  type="button"
                  onClick={() => setColor(projectColor)}
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    color === projectColor && "ring-2 ring-foreground scale-110",
                  )}
                  style={{ backgroundColor: projectColor }}
                />
              ))}
            </div>
          </div>
        </div>
        <Button onClick={onSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {buttonLabel}
        </Button>
      </div>
    );
  }

  function renderProjectCard(item: ProjectAnalytics) {
    const { project, sessions: projectSessions, todaySeconds, totalSeconds, todayValue, totalValue, lastSessionAt, isActive } = item;
    const isExpanded = expandedProject === project.id;
    const primaryActionLabel = totalSeconds > 0 ? "Continuar" : "Iniciar";

    return (
      <div
        key={project.id}
        className={cn(
          "rounded-2xl border bg-card/95 transition-all",
          isActive ? "border-primary/40 bg-primary/[0.06] shadow-[0_20px_60px_-40px_rgba(34,211,238,0.55)]" : "border-border hover:border-primary/25",
        )}
      >
        <div className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: project.color }} />
                <h3 className="truncate text-lg font-semibold text-foreground">{project.name}</h3>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {formatMoney(project.hourly_rate)}/h
                </span>
                {isActive ? (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    Em andamento
                  </span>
                ) : todaySeconds > 0 ? (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Trabalhado hoje
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{project.client || "Sem cliente definido"}</span>
                <span>Ultima sessao: {formatSessionMoment(lastSessionAt)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[380px] xl:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/35 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Hoje</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="font-mono text-xl font-semibold tabular-nums text-foreground">{formatDuration(isActive ? timer.elapsed : todaySeconds)}</p>
                  <p className="font-mono text-sm font-semibold text-emerald-300">{formatMoney(((isActive ? timer.elapsed : todaySeconds) / 3600) * project.hourly_rate)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/35 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Acumulado</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="font-mono text-xl font-semibold tabular-nums text-foreground">{formatShortDuration(totalSeconds)}</p>
                  <p className="font-mono text-sm font-semibold text-cyan-300">{formatMoney(totalValue)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-background/60 px-2.5 py-1">Hoje: {formatShortDuration(isActive ? timer.elapsed : todaySeconds)}</span>
              <span className="rounded-full bg-background/60 px-2.5 py-1">Faturado hoje: {formatMoney(isActive ? (timer.elapsed / 3600) * project.hourly_rate : todayValue)}</span>
              <span className="rounded-full bg-background/60 px-2.5 py-1">{projectSessions.length} sessoes</span>
            </div>

            <div className="flex items-center gap-1">
              {!isActive ? (
                <Button onClick={() => handleStart(project.id)} size="sm" className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20">
                  <Play className="mr-1 h-3.5 w-3.5" />
                  {primaryActionLabel}
                </Button>
              ) : (
                <Button onClick={handleStop} size="sm" className="bg-danger-muted text-danger hover:bg-danger/20">
                  <Square className="mr-1 h-3.5 w-3.5" />
                  Parar
                </Button>
              )}

              <button type="button" onClick={() => openEditDialog(project)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => deleteProject(project.id)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>

              {projectSessions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div className="border-t border-border/70 px-5 py-4 animate-fade-in">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Historico recente</p>
              <span className="text-xs text-muted-foreground">Ultimas {Math.min(projectSessions.length, 8)} sessoes</span>
            </div>

            <div className="space-y-2">
              {projectSessions.slice(0, 8).map((session) => (
                <div key={session.id} className="grid gap-2 rounded-xl border border-border/70 bg-background/35 px-3 py-3 text-xs md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center md:gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{new Date(session.started_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                    <p className="text-muted-foreground">
                      {new Date(session.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" - "}
                      {session.ended_at ? new Date(session.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "..."}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-muted-foreground">{formatDuration(session.duration_seconds || 0)}</span>
                  <span className="font-mono tabular-nums text-emerald-300">
                    {formatMoney(((session.duration_seconds || 0) / 3600) * project.hourly_rate)}
                  </span>
                  <span className="text-muted-foreground">{project.client || "Sem cliente"}</span>
                  <button
                    type="button"
                    onClick={() => deleteSession(session.id)}
                    className="justify-self-end rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (authLoading || loading) {
    return <LoadingState message="Carregando projetos e sessoes..." />;
  }

  if (!user) {
    return (
      <EmptyState
        icon={Activity}
        title="Sessao expirada"
        description="Entre novamente para carregar seus projetos e sessoes."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          className="flex-1"
          title="Time Tracker"
          description="Acompanhe foco, horas do dia e valor gerado sem perder o projeto que importa agora."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Novo Projeto</DialogTitle>
            </DialogHeader>
            {renderProjectForm(newName, setNewName, newClient, setNewClient, newRate, setNewRate, newColor, setNewColor, createProject, "Criar Projeto")}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
          </DialogHeader>
          {renderProjectForm(editName, setEditName, editClient, setEditClient, editRate, setEditRate, editColor, setEditColor, updateProject, "Salvar Alteracoes")}
        </DialogContent>
      </Dialog>

      <section className="grid gap-3 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr]">
        <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(8,18,38,0.96),rgba(15,25,44,0.92))] p-5 shadow-[0_20px_60px_-40px_rgba(34,211,238,0.5)]">
          <div className="flex items-center gap-2 text-cyan-200/80">
            <Activity className="h-4 w-4 text-cyan-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sessao ativa</p>
          </div>
          <div className="mt-3">
            <p className="text-lg font-semibold text-foreground">{activeProject ? activeProject.name : "Nenhum projeto em andamento"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeProject ? activeProject.client || "Sem cliente definido" : "Escolha um projeto para iniciar a proxima sessao."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{formatDuration(timer.elapsed)}</p>
              <p className="mt-1 text-sm text-emerald-300">
                {activeProject ? formatMoney((timer.elapsed / 3600) * activeProject.hourly_rate) : formatMoney(0)}
              </p>
            </div>
            {activeProject ? (
              <Button onClick={handleStop} className="bg-danger-muted text-danger hover:bg-danger/20">
                <Square className="mr-2 h-4 w-4" />
                Finalizar sessao
              </Button>
            ) : (
              <span className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                Nenhuma sessao rodando agora
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Horas hoje</p>
          </div>
          <p className="mt-4 font-mono text-3xl font-semibold tabular-nums text-foreground">{formatDuration(trackerSummary.todaySeconds + timer.elapsed)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{trackerSummary.workedTodayCount} projetos com registro hoje</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4 text-emerald-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Valor hoje</p>
          </div>
          <p className="mt-4 font-mono text-3xl font-semibold tabular-nums text-foreground">{formatMoney(trackerSummary.todayValue + (activeProject ? (timer.elapsed / 3600) * activeProject.hourly_rate : 0))}</p>
          <p className="mt-2 text-sm text-muted-foreground">Estimativa baseada na taxa/hora dos projetos</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 text-cyan-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Maior foco</p>
          </div>
          <p className="mt-4 text-lg font-semibold text-foreground">
            {trackerSummary.topProjectToday && trackerSummary.topProjectToday.todaySeconds > 0
              ? trackerSummary.topProjectToday.project.name
              : "Ainda sem lider hoje"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {trackerSummary.topProjectToday && trackerSummary.topProjectToday.todaySeconds > 0
              ? `${formatShortDuration(trackerSummary.topProjectToday.todaySeconds)} hoje`
              : "Comece a primeira sessao para ver destaque aqui"}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/95 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Radar de projetos</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Escolha rapida do proximo foco</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar projeto ou cliente"
                className="h-10 rounded-2xl border-border bg-background/60 pl-10 sm:w-[280px]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "Todos", value: "all" as const },
                { label: "Com tempo hoje", value: "today" as const },
                { label: "Sem uso hoje", value: "idle" as const },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs transition-colors",
                    filter === option.value
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {projects.length === 0 ? (
        <EmptyState
          icon={Loader2}
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto para comecar a rastrear tempo."
        />
      ) : filteredAnalytics.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nada encontrado"
          description="Tente outro termo de busca ou ajuste o filtro para ver mais projetos."
        />
      ) : (
        <div className="space-y-6">
          {activeAnalytics ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Em andamento</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Projeto ativo agora</h2>
                </div>
              </div>
              {renderProjectCard(activeAnalytics)}
            </section>
          ) : null}

          {workedTodayProjects.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Ritmo do dia</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Projetos com registro hoje</h2>
                </div>
                <span className="rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  {workedTodayProjects.length} ativos no dia
                </span>
              </div>
              <div className="space-y-3">
                {workedTodayProjects.map(renderProjectCard)}
              </div>
            </section>
          ) : null}

          {idleProjects.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Fila de apoio</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Projetos sem uso hoje</h2>
                </div>
                <span className="rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  {idleProjects.length} disponiveis
                </span>
              </div>
              <div className="space-y-3">
                {idleProjects.map(renderProjectCard)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
