import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Loader2, ChevronLeft, ChevronRight, Check, Trash2, Pencil, X } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { getQuadrant, toTaskFields } from "@/lib/eisenhower";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GENERAL_PROJECT_VALUE,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
import {
  KANBAN_IMPORTANCE_OPTIONS as IMPORTANCE_OPTIONS,
  KANBAN_PRIORITIES as PRIORITIES,
  KANBAN_URGENCY_OPTIONS as URGENCY_OPTIONS,
} from "@/config/priorities";
import type { Task, Subtask, Project, EisenhowerQuadrant } from "@/types";

const COLUMNS = [
  { index: 0, title: "A Fazer", color: "border-t-warning" },
  { index: 1, title: "Em Andamento", color: "border-t-info" },
  { index: 2, title: "Concluido", color: "border-t-success" },
];

const QUADRANT_BADGE: Record<EisenhowerQuadrant, { label: string; className: string }> = {
  do_now: { label: "Fazer Agora", className: "bg-danger-muted text-danger" },
  schedule: { label: "Agendar", className: "bg-info-muted text-info" },
  delegate: { label: "Delegar", className: "bg-warning-muted text-warning" },
  eliminate: { label: "Eliminar", className: "bg-secondary text-muted-foreground" },
};

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-3 min-h-[100px] rounded-lg p-1 transition-colors",
        isOver && "bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      {children}
    </div>
  );
}


const TaskCard = React.memo(({ task, companyLabel, onMove, onToggleSubtask, onAddSubtask, onDelete, onEdit }: {
  task: Task;
  companyLabel: string | null;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggleSubtask: (subtaskId: string, completed: boolean) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}) => {
  const [newSubtask, setNewSubtask] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { columnIndex: task.column_index },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priority = PRIORITIES.find((p) => p.value === task.priority);
  const quadrant = QUADRANT_BADGE[getQuadrant(task)];
  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/20 cursor-grab active:cursor-grabbing group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground flex-1">{task.title}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => onEdit(task)} className="p-1 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1 text-muted-foreground hover:text-danger">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {priority ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priority.className)}>
              {priority.label}
            </span>
          ) : null}
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", quadrant.className)}>
            {quadrant.label}
          </span>
        </div>
      </div>

      {companyLabel ? (
        <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground mb-2">
          {companyLabel}
        </span>
      ) : null}

      {task.due_date ? (
        <p className="text-[10px] text-muted-foreground mb-2">
          Prazo: {new Date(task.due_date).toLocaleDateString("pt-BR")}
        </p>
      ) : null}

      {/* Subtasks */}
      {subtasks.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {completedCount}/{subtasks.length}
            </span>
          </div>
          {subtasks.map((st) => (
            <label
              key={st.id}
              className="flex items-center gap-2 cursor-pointer group/sub"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onToggleSubtask(st.id, !st.completed)}
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  st.completed
                    ? "bg-primary border-primary"
                    : "border-border group-hover/sub:border-muted-foreground"
                )}
              >
                {st.completed ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
              </button>
              <span className={cn(
                "text-xs transition-colors",
                st.completed ? "text-muted-foreground line-through" : "text-foreground"
              )}>
                {st.title}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {/* Add Subtask */}
      <div className="mt-2" onPointerDown={(e) => e.stopPropagation()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newSubtask.trim()) {
              onAddSubtask(task.id, newSubtask.trim());
              setNewSubtask("");
            }
          }}
          className="flex gap-1"
        >
          <Input
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            placeholder="+ Subtarefa"
            className="h-7 text-xs bg-background border-border"
          />
        </form>
      </div>

      {/* Mobile Move Buttons */}
      <div className="flex gap-2 mt-3 md:hidden" onPointerDown={(e) => e.stopPropagation()}>
        {task.column_index > 0 ? (
          <Button size="sm" variant="outline" onClick={() => onMove(task.id, -1)} className="h-7 text-xs flex-1 border-border">
            <ChevronLeft className="h-3 w-3 mr-1" /> Voltar
          </Button>
        ) : null}
        {task.column_index < 2 ? (
          <Button size="sm" variant="outline" onClick={() => onMove(task.id, 1)} className="h-7 text-xs flex-1 border-border">
            Avancar <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
});

export default function KanbanPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState(0);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newProjectValue, setNewProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [newPriority, setNewPriority] = useState<Task["priority"]>("normal");
  const [newUrgency, setNewUrgency] = useState<Task["urgency"]>("not_urgent");
  const [newImportance, setNewImportance] = useState<Task["importance"]>("important");
  const [newDueDate, setNewDueDate] = useState("");

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editProjectValue, setEditProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [editPriority, setEditPriority] = useState<Task["priority"]>("normal");
  const [editUrgency, setEditUrgency] = useState<Task["urgency"]>("not_urgent");
  const [editImportance, setEditImportance] = useState<Task["importance"]>("important");
  const [editDueDate, setEditDueDate] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [tasksRes, projRes] = await Promise.all([
        supabase.from("tasks").select("*").order("position"),
        supabase.from("projects").select("*").order("name"),
      ]);

      const tasksList = (tasksRes.data || []) as unknown as Task[];
      setProjects((projRes.data || []) as unknown as Project[]);

      if (tasksList.length > 0) {
        const taskIds = tasksList.map((t) => t.id);
        const { data: subtasksData } = await supabase
          .from("subtasks")
          .select("*")
          .in("task_id", taskIds)
          .order("position");

        const subtasksList = (subtasksData || []) as unknown as Subtask[];
        const tasksWithSubs = tasksList.map((t) => ({
          ...t,
          subtasks: subtasksList.filter((s) => s.task_id === t.id),
        }));
        setTasks(tasksWithSubs);
      } else {
        setTasks([]);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados do Kanban");
    } finally {
      setLoading(false);
    }
  }

  async function createTask() {
    if (!newTitle || !user) return;
    const projectId = projectIdFromSelectValue(newProjectValue);
    const selectedProject = projects.find((project) => project.id === projectId) || null;
    const maxPos = Math.max(0, ...tasks.filter((t) => t.column_index === 0).map((t) => t.position));
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: newTitle,
      project_id: projectId,
      client: selectedProject?.name || null,
      priority: newPriority,
      urgency: newUrgency,
      importance: newImportance,
      due_date: newDueDate || null,
      column_index: 0,
      position: maxPos + 1,
    });
    if (error) {
      toast.error("Erro ao criar tarefa");
    } else {
      toast.success("Tarefa criada!");
      setDialogOpen(false);
      setNewTitle("");
      setNewProjectValue(GENERAL_PROJECT_VALUE);
      setNewPriority("normal");
      setNewUrgency("not_urgent");
      setNewImportance("important");
      setNewDueDate("");
      loadData();
    }
  }

  async function updateTask() {
    if (!editingTask || !editTitle) return;
    const projectId = projectIdFromSelectValue(editProjectValue);
    const selectedProject = projects.find((project) => project.id === projectId) || null;
    const { error } = await supabase.from("tasks").update({
      title: editTitle,
      project_id: projectId,
      client: selectedProject?.name || null,
      priority: editPriority,
      urgency: editUrgency,
      importance: editImportance,
      due_date: editDueDate || null,
    }).eq("id", editingTask.id);

    if (error) {
      toast.error("Erro ao atualizar tarefa");
    } else {
      toast.success("Tarefa atualizada!");
      setEditDialogOpen(false);
      setEditingTask(null);
      loadData();
    }
  }

  async function deleteTask(taskId: string) {
    // Delete subtasks first
    await supabase.from("subtasks").delete().eq("task_id", taskId);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Erro ao excluir tarefa");
    } else {
      toast.success("Tarefa excluida!");
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  function openEditDialog(task: Task) {
    const fallbackFields = toTaskFields(getQuadrant(task));
    const matchedProjectId =
      task.project_id ||
      projects.find((project) => project.name === task.client || project.client === task.client)?.id ||
      null;

    setEditingTask(task);
    setEditTitle(task.title);
    setEditProjectValue(projectSelectValue(matchedProjectId));
    setEditPriority(task.priority);
    setEditUrgency(task.urgency || fallbackFields.urgency);
    setEditImportance(task.importance || fallbackFields.importance);
    setEditDueDate(task.due_date || "");
    setEditDialogOpen(true);
  }

  async function moveTask(taskId: string, direction: -1 | 1) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newCol = task.column_index + direction;
    if (newCol < 0 || newCol > 2) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column_index: newCol } : t))
    );
    await supabase.from("tasks").update({ column_index: newCol }).eq("id", taskId);
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        subtasks: t.subtasks?.map((s) =>
          s.id === subtaskId ? { ...s, completed } : s
        ),
      }))
    );
    await supabase.from("subtasks").update({ completed }).eq("id", subtaskId);
  }

  async function addSubtask(taskId: string, title: string) {
    const maxPos = Math.max(
      0,
      ...(tasks.find((t) => t.id === taskId)?.subtasks?.map((s) => s.position) || [0])
    );
    const { data } = await supabase
      .from("subtasks")
      .insert({ task_id: taskId, title, position: maxPos + 1 })
      .select()
      .single();

    if (data) {
      const newSub = data as unknown as Subtask;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: [...(t.subtasks || []), newSub] }
            : t
        )
      );
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Determine target column
    let targetColumn: number | null = null;

    // Check if over a column droppable
    const overId = String(over.id);
    if (overId.startsWith("column-")) {
      targetColumn = parseInt(overId.replace("column-", ""));
    } else {
      // Over a task - get its column
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) {
        targetColumn = overTask.column_index;
      }
    }

    if (targetColumn !== null && activeTask.column_index !== targetColumn) {
      setTasks((prev) =>
        prev.map((t) => (t.id === String(active.id) ? { ...t, column_index: targetColumn! } : t))
      );
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active } = event;
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Persist final column
    await supabase.from("tasks").update({ column_index: activeTask.column_index }).eq("id", String(active.id));
  }

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  if (loading) {
    return <LoadingState message="Carregando quadro Kanban..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader className="flex-1" title="Kanban" description="Organize tarefas por coluna e prioridade." />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Nova Tarefa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Titulo</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="O que precisa ser feito?" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={newProjectValue} onValueChange={setNewProjectValue}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Conhecimento geral" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GENERAL_PROJECT_VALUE}>Conhecimento geral</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setNewPriority(p.value)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-all",
                        newPriority === p.value ? p.className + " ring-1 ring-foreground/20" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Urgencia</Label>
                  <Select value={newUrgency} onValueChange={(value) => setNewUrgency(value as Task["urgency"])}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Importancia</Label>
                  <Select
                    value={newImportance}
                    onValueChange={(value) => setNewImportance(value as Task["importance"])}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORTANCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Prazo</Label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="bg-background border-border" />
              </div>
              <Button onClick={createTask} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Criar Tarefa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Titulo</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={editProjectValue} onValueChange={setEditProjectValue}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Conhecimento geral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_PROJECT_VALUE}>Conhecimento geral</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setEditPriority(p.value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-all",
                      editPriority === p.value ? p.className + " ring-1 ring-foreground/20" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Urgencia</Label>
                <Select value={editUrgency} onValueChange={(value) => setEditUrgency(value as Task["urgency"])}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Importancia</Label>
                <Select
                  value={editImportance}
                  onValueChange={(value) => setEditImportance(value as Task["importance"])}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prazo</Label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="bg-background border-border" />
            </div>
            <Button onClick={updateTask} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Salvar Alteracoes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Column Selector */}
      <div className="flex gap-2 md:hidden">
        {COLUMNS.map((col) => (
          <button
            key={col.index}
            onClick={() => setMobileColumn(col.index)}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-medium transition-colors",
              mobileColumn === col.index
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {col.title} ({tasks.filter((t) => t.column_index === col.index).length})
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.column_index === col.index);
            const isVisible = !isMobile || mobileColumn === col.index;

            if (!isVisible) return null;

            return (
              <div
                key={col.index}
                className={cn(
                  "rounded-xl border border-border bg-card/50 p-4 border-t-[3px]",
                  col.color
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {columnTasks.length}
                  </span>
                </div>

                <SortableContext
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn id={`column-${col.index}`}>
                    {columnTasks.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                        <p className="text-xs text-muted-foreground">Arraste aqui</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          companyLabel={task.project_id ? projectMap.get(task.project_id)?.name || task.client : task.client}
                          onMove={moveTask}
                          onToggleSubtask={toggleSubtask}
                          onAddSubtask={addSubtask}
                          onDelete={deleteTask}
                          onEdit={openEditDialog}
                        />
                      ))
                    )}
                  </DroppableColumn>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}




