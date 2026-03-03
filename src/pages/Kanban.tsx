import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task, Subtask } from "@/types";

const COLUMNS = [
  { index: 0, title: "📋 A Fazer", color: "border-t-warning" },
  { index: 1, title: "🔄 Em Andamento", color: "border-t-info" },
  { index: 2, title: "✅ Concluído", color: "border-t-success" },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgente", className: "bg-danger-muted text-danger" },
  { value: "high", label: "Alta", className: "bg-warning-muted text-warning" },
  { value: "normal", label: "Normal", className: "bg-info-muted text-info" },
  { value: "low", label: "Baixa", className: "bg-secondary text-muted-foreground" },
];

function TaskCard({ task, onMove, onToggleSubtask, onAddSubtask }: {
  task: Task;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggleSubtask: (subtaskId: string, completed: boolean) => void;
  onAddSubtask: (taskId: string, title: string) => void;
}) {
  const [newSubtask, setNewSubtask] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { columnIndex: task.column_index },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = PRIORITIES.find((p) => p.value === task.priority);
  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/20 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        {priority && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", priority.className)}>
            {priority.label}
          </span>
        )}
      </div>

      {task.client && (
        <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground mb-2">
          {task.client}
        </span>
      )}

      {task.due_date && (
        <p className="text-[10px] text-muted-foreground mb-2">
          📅 {new Date(task.due_date).toLocaleDateString("pt-BR")}
        </p>
      )}

      {/* Subtasks */}
      {subtasks.length > 0 && (
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
              className="flex items-center gap-2 cursor-pointer group"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onToggleSubtask(st.id, !st.completed)}
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  st.completed
                    ? "bg-primary border-primary"
                    : "border-border group-hover:border-muted-foreground"
                )}
              >
                {st.completed && <Check className="h-3 w-3 text-primary-foreground" />}
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
      )}

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
        {task.column_index > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMove(task.id, -1)}
            className="h-7 text-xs flex-1 border-border"
          >
            <ChevronLeft className="h-3 w-3 mr-1" /> Voltar
          </Button>
        )}
        {task.column_index < 2 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMove(task.id, 1)}
            className="h-7 text-xs flex-1 border-border"
          >
            Avançar <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState(0);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newDueDate, setNewDueDate] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (user) loadTasks();
  }, [user]);

  async function loadTasks() {
    setLoading(true);
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .order("position");

    const tasksList = (tasksData || []) as unknown as Task[];

    // Load subtasks for each task
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
    setLoading(false);
  }

  async function createTask() {
    if (!newTitle || !user) return;
    const maxPos = Math.max(0, ...tasks.filter((t) => t.column_index === 0).map((t) => t.position));
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: newTitle,
      client: newClient || null,
      priority: newPriority,
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
      setNewClient("");
      setNewPriority("normal");
      setNewDueDate("");
      loadTasks();
    }
  }

  async function moveTask(taskId: string, direction: -1 | 1) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newCol = task.column_index + direction;
    if (newCol < 0 || newCol > 2) return;

    // Optimistic
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

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped on a column
    const overColumnIndex = COLUMNS.findIndex((c) => `column-${c.index}` === String(over.id));
    if (overColumnIndex >= 0 && activeTask.column_index !== overColumnIndex) {
      setTasks((prev) =>
        prev.map((t) => (t.id === String(active.id) ? { ...t, column_index: overColumnIndex } : t))
      );
      await supabase.from("tasks").update({ column_index: overColumnIndex }).eq("id", String(active.id));
      return;
    }

    // Dropped on another task
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask && activeTask.column_index !== overTask.column_index) {
      setTasks((prev) =>
        prev.map((t) => (t.id === String(active.id) ? { ...t, column_index: overTask.column_index } : t))
      );
      await supabase.from("tasks").update({ column_index: overTask.column_index }).eq("id", String(active.id));
    }
  }

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
          <h1 className="text-2xl font-bold text-foreground">Kanban</h1>
          <p className="text-sm text-muted-foreground">Organize suas tarefas</p>
        </div>
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
                <Label className="text-xs text-muted-foreground">Título</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="O que precisa ser feito?"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Input
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Nome do cliente"
                  className="bg-background border-border"
                />
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Prazo</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <Button onClick={createTask} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Criar Tarefa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.column_index === col.index);
            const isVisible = window.innerWidth >= 768 || mobileColumn === col.index;

            if (!isVisible) return null;

            return (
              <div
                key={col.index}
                id={`column-${col.index}`}
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
                  <div className="space-y-3 min-h-[100px]">
                    {columnTasks.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                        <p className="text-xs text-muted-foreground">Arraste aqui</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onMove={moveTask}
                          onToggleSubtask={toggleSubtask}
                          onAddSubtask={addSubtask}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
