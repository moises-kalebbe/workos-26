import { useState, useEffect } from "react";
import { Plus, Play, Square, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDuration, formatMoney } from "@/lib/utils";
import { toast } from "sonner";
import type { Project, TimeSession } from "@/types";

export default function TrackerPage() {
  const { user } = useAuth();
  const timer = useTimer();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // New project form
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [projRes, sessRes] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("time_sessions").select("*").not("ended_at", "is", null).order("started_at", { ascending: false }),
    ]);
    setProjects((projRes.data || []) as unknown as Project[]);
    setSessions((sessRes.data || []) as unknown as TimeSession[]);
    setLoading(false);
  }

  async function createProject() {
    if (!newName || !user) return;
    const { error } = await supabase.from("projects").insert({
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
      loadData();
    }
  }

  async function handleStart(projectId: string) {
    if (!user) return;
    await timer.start(projectId, user.id);
    toast.success("Timer iniciado!");
  }

  async function handleStop() {
    await timer.stop();
    toast.success("Timer finalizado!");
    loadData();
  }

  const activeProject = projects.find((p) => p.id === timer.activeProjectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Time Tracker</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus projetos e controle o tempo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Novo Projeto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome do projeto</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Website Redesign"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Input
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Ex: Empresa X"
                  className="bg-background border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">R$/hora</Label>
                  <Input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    placeholder="150"
                    className="bg-background border-border font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Cor</Label>
                  <div className="flex gap-2">
                    {["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`h-8 w-8 rounded-lg transition-all ${newColor === c ? "ring-2 ring-foreground scale-110" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={createProject} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Criar Projeto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Timer Banner */}
      {timer.isRunning && activeProject && (
        <div className="animate-fade-in rounded-xl border border-primary bg-primary/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-danger" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-text">
                  Trabalhando agora
                </span>
              </div>
              <div className="text-lg font-bold text-foreground">{activeProject.name}</div>
              {activeProject.client && (
                <div className="text-sm text-muted-foreground">{activeProject.client}</div>
              )}
            </div>
            <div className="text-center">
              <div className="font-mono text-4xl font-bold tabular-nums text-primary">
                {formatDuration(timer.elapsed)}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-success">
                {formatMoney((timer.elapsed / 3600) * activeProject.hourly_rate)}
              </div>
            </div>
            <Button
              onClick={handleStop}
              className="bg-danger-muted text-danger hover:bg-danger/20"
            >
              <Square className="mr-2 h-4 w-4" />
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-4xl mb-3">⏱️</p>
          <p className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</p>
          <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro projeto para começar a rastrear tempo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const projectSessions = sessions.filter((s) => s.project_id === project.id);
            const totalSeconds = projectSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
            const totalValue = (totalSeconds / 3600) * project.hourly_rate;
            const isExpanded = expandedProject === project.id;
            const isActive = timer.activeProjectId === project.id;

            return (
              <div
                key={project.id}
                className={`rounded-xl border bg-card transition-colors ${
                  isActive ? "border-primary" : "border-border hover:border-muted-foreground/20"
                }`}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.client || "Sem cliente"} · {formatMoney(project.hourly_rate)}/h
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="font-mono text-sm tabular-nums text-muted-foreground">
                          {formatDuration(totalSeconds)}
                        </p>
                        <p className="font-mono text-xs text-success tabular-nums">
                          {formatMoney(totalValue)}
                        </p>
                      </div>

                      {!isActive ? (
                        <Button
                          onClick={() => handleStart(project.id)}
                          size="sm"
                          className="bg-success-muted text-success hover:bg-success/20"
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Iniciar
                        </Button>
                      ) : (
                        <Button
                          onClick={handleStop}
                          size="sm"
                          className="bg-danger-muted text-danger hover:bg-danger/20"
                        >
                          <Square className="mr-1 h-3 w-3" />
                          Parar
                        </Button>
                      )}

                      {projectSessions.length > 0 && (
                        <button
                          onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session History */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-3 animate-fade-in">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Histórico
                    </p>
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {projectSessions.slice(0, 10).map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between rounded-lg bg-background p-2 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {new Date(session.started_at).toLocaleDateString("pt-BR")}
                          </span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {new Date(session.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {session.ended_at
                              ? new Date(session.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                              : "..."}
                          </span>
                          <span className="font-mono tabular-nums text-foreground">
                            {formatDuration(session.duration_seconds || 0)}
                          </span>
                          <span className="font-mono tabular-nums text-success">
                            {formatMoney(((session.duration_seconds || 0) / 3600) * project.hourly_rate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
