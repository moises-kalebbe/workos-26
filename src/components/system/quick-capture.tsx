"use client";

import { useState } from "react";
import { Plus, FileText, CheckSquare, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type Project = { id: string; name: string };

export function QuickCapture() {
  const { user } = useAuth();
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  // Note state
  const [noteTitle, setNoteTitle] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Task state
  const [taskTitle, setTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Timer state
  const [selectedProject, setSelectedProject] = useState<string>("");

  useEffect(() => {
    if (!open || !user) return;
    void (db as any)
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("name")
      .then(({ data }: any) => setProjects(data || []));
  }, [open, user]);

  async function saveNote() {
    if (!noteTitle.trim() || !user) return;
    setSavingNote(true);
    const slug = noteTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + "-" + Date.now();
    const { error } = await (db as any).from("second_brain_notes").insert({
      user_id: user.id,
      title: noteTitle.trim(),
      slug,
      content_md: "",
      tags: [],
      status: "inbox",
      captured_at: new Date().toISOString(),
      source_type: "manual",
    });
    setSavingNote(false);
    if (error) { toast.error("Erro ao salvar nota."); return; }
    toast.success("Nota capturada no inbox.");
    setNoteTitle("");
    setOpen(false);
  }

  async function saveTask() {
    if (!taskTitle.trim() || !user) return;
    setSavingTask(true);
    const { error } = await (db as any).from("tasks").insert({
      user_id: user.id,
      title: taskTitle.trim(),
      column_index: 0,
      priority: "normal",
      urgency: "not_urgent",
      importance: "important",
      position: Date.now(),
    });
    setSavingTask(false);
    if (error) { toast.error("Erro ao salvar tarefa."); return; }
    toast.success("Tarefa adicionada ao Kanban.");
    setTaskTitle("");
    setOpen(false);
  }

  async function startTimer() {
    if (!selectedProject || !user) return;
    const project = projects.find((p) => p.id === selectedProject);
    await timer.start(selectedProject, user.id);
    toast.success(`Timer iniciado para ${project?.name ?? "projeto"}`);
    setOpen(false);
  }

  return (
    <>
      {/* FAB — visible on mobile, hidden on md+ */}
      <button
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Captura rápida"
      >
        <Plus className="h-6 w-6 text-primary-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Captura rápida</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="note">
            <TabsList className="w-full">
              <TabsTrigger value="note" className="flex-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Nota
              </TabsTrigger>
              <TabsTrigger value="task" className="flex-1 gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" /> Tarefa
              </TabsTrigger>
              <TabsTrigger value="timer" className="flex-1 gap-1.5">
                <Timer className="h-3.5 w-3.5" /> Timer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="note" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Título da nota</Label>
                <Input
                  autoFocus
                  placeholder="O que você quer capturar?"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void saveNote()}
                />
              </div>
              <p className="text-xs text-muted-foreground">Vai para o inbox do Second Brain.</p>
              <Button className="w-full" onClick={() => void saveNote()} disabled={savingNote || !noteTitle.trim()}>
                {savingNote ? "Salvando..." : "Capturar nota"}
              </Button>
            </TabsContent>

            <TabsContent value="task" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Título da tarefa</Label>
                <Input
                  autoFocus
                  placeholder="O que precisa ser feito?"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void saveTask()}
                />
              </div>
              <p className="text-xs text-muted-foreground">Vai para A Fazer no Kanban.</p>
              <Button className="w-full" onClick={() => void saveTask()} disabled={savingTask || !taskTitle.trim()}>
                {savingTask ? "Salvando..." : "Adicionar tarefa"}
              </Button>
            </TabsContent>

            <TabsContent value="timer" className="mt-4 space-y-3">
              {timer.isRunning ? (
                <div className="rounded-xl border border-border bg-background/50 p-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Timer já rodando.</p>
                  <Button variant="destructive" className="w-full" onClick={() => { void timer.stop(); setOpen(false); }}>
                    Parar timer
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Projeto</Label>
                    <div className="grid gap-2">
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProject(p.id)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                            selectedProject === p.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background/50 text-foreground hover:border-primary/30"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => void startTimer()} disabled={!selectedProject}>
                    <Timer className="mr-2 h-4 w-4" />
                    Iniciar timer
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
