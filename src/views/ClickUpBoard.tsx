"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { clickupApi } from "@/features/clickup/api";
import type { CUMember, CUStatus, CUTask } from "@/features/clickup/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<string, string> = {
  "1": "Urgente",
  "2": "Alta",
  "3": "Normal",
  "4": "Baixa",
};
const PRIORITY_COLORS: Record<string, string> = {
  "1": "bg-red-500/20 text-red-400",
  "2": "bg-orange-500/20 text-orange-400",
  "3": "bg-blue-500/20 text-blue-400",
  "4": "bg-muted text-muted-foreground",
};

function formatDueDate(ms: string | null) {
  if (!ms) return null;
  const d = new Date(Number(ms));
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function isDueSoon(ms: string | null) {
  if (!ms) return false;
  return Number(ms) < Date.now() + 1000 * 60 * 60 * 48;
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onClick,
  overlay = false,
}: {
  task: CUTask;
  onClick?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: overlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityKey = task.priority?.orderindex ?? "";
  const due = formatDueDate(task.due_date);
  const overdue = task.due_date && Number(task.due_date) < Date.now();

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-xl border border-border bg-card/90 p-3 shadow-sm",
        "hover:border-primary/40 hover:bg-card transition-colors",
        overlay && "shadow-xl ring-2 ring-primary/30",
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">{task.name}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {priorityKey && (
          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", PRIORITY_COLORS[priorityKey])}>
            {PRIORITY_LABELS[priorityKey]}
          </span>
        )}
        {due && (
          <span className={cn("text-xs", overdue ? "text-red-400" : isDueSoon(task.due_date) ? "text-orange-400" : "text-muted-foreground")}>
            {due}
          </span>
        )}
      </div>

      {(task.assignees ?? []).length > 0 && (
        <div className="mt-2 flex gap-1">
          {(task.assignees ?? []).slice(0, 3).filter((a) => a?.id != null).map((a) => (
            <div
              key={a.id}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: a.color || "#7B68EE" }}
              title={a.username}
            >
              {a.username.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  status,
  tasks,
  onTaskClick,
}: {
  status: CUStatus;
  tasks: CUTask[];
  onTaskClick: (task: CUTask) => void;
}) {
  const ids = tasks.map((t) => t.id);

  return (
    <div className="flex min-h-[200px] w-72 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: status.color || "#888" }}
          />
          <span className="text-sm font-semibold capitalize text-foreground">
            {status.status}
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Task Detail Dialog ───────────────────────────────────────────────────────

function TaskDetailDialog({
  task,
  statuses,
  members,
  onClose,
  onSave,
}: {
  task: CUTask | null;
  statuses: CUStatus[];
  members: CUMember[];
  onClose: () => void;
  onSave: (taskId: string, updates: { name?: string; description?: string; status?: string; due_date?: number | null }) => Promise<void>;
}) {
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status.status ?? "");
  const [dueDate, setDueDate] = useState(
    task?.due_date ? new Date(Number(task.due_date)).toISOString().slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description ?? "");
      setStatus(task.status.status);
      setDueDate(task.due_date ? new Date(Number(task.due_date)).toISOString().slice(0, 10) : "");
    }
  }, [task]);

  if (!task) return null;

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    try {
      await onSave(task.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        due_date: dueDate ? new Date(dueDate).getTime() : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate">Editar tarefa</span>
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label>Título</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descrição</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.status} value={s.status}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="capitalize">{s.status}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data limite</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Task Dialog ───────────────────────────────────────────────────────

function CreateTaskDialog({
  open,
  statuses,
  listId,
  onClose,
  onCreate,
}: {
  open: boolean;
  statuses: CUStatus[];
  listId: string;
  onClose: () => void;
  onCreate: (listId: string, payload: { name: string; status?: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(statuses[0]?.status ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setStatus(statuses[0]?.status ?? "");
    }
  }, [open, statuses]);

  async function handleCreate() {
    if (!name.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    try {
      await onCreate(listId, { name: name.trim(), description: description.trim() || undefined, status });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Nova tarefa no ClickUp</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label>Título *</Label>
            <Input placeholder="Nome da tarefa" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status inicial</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.status} value={s.status}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="capitalize">{s.status}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar tarefa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export default function ClickUpBoard({ viewId }: { viewId: string | null | undefined }) {
  const [tasks, setTasks] = useState<CUTask[]>([]);
  const [statuses, setStatuses] = useState<CUStatus[]>([]);
  const [members, setMembers] = useState<CUMember[]>([]);
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const [activeTask, setActiveTask] = useState<CUTask | null>(null);
  const [detailTask, setDetailTask] = useState<CUTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState("__all__");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadBoard = useCallback(async () => {
    if (!viewId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      // Se for Space ID (só dígitos), resolve a primeira board view do espaço
      const isSpaceId = /^\d+$/.test(viewId);
      let resolvedViewId = viewId;
      if (isSpaceId) {
        const spaceViews = await clickupApi.getSpaceViews(viewId);
        const boardView = spaceViews.views.find((v) => v.type === "board") ?? spaceViews.views[0];
        if (!boardView) throw new Error("Nenhuma view encontrada neste espaço");
        resolvedViewId = boardView.id;
      }

      const [viewRes, tasksRes] = await Promise.all([
        clickupApi.getView(resolvedViewId),
        clickupApi.getViewTasks(resolvedViewId),
      ]);

      const view = viewRes?.view;
      if (!view) throw new Error("View não encontrada ou sem permissão de acesso");
      const resolvedListId = view.parent?.id ?? "";
      setListId(resolvedListId);

      // Statuses come from the list, not the view
      let rawStatuses: CUStatus[] = view.list?.statuses ?? [];
      if (rawStatuses.length === 0 && resolvedListId) {
        try {
          const listRes = await clickupApi.getList(resolvedListId);
          rawStatuses = listRes?.statuses ?? [];
        } catch {
          // fallback: derive statuses from tasks
        }
      }
      // Fallback: derive unique statuses from tasks
      if (rawStatuses.length === 0) {
        const seen = new Set<string>();
        rawStatuses = (tasksRes?.tasks ?? [])
          .filter((t) => t?.status?.status && !seen.has(t.status.status) && seen.add(t.status.status))
          .map((t) => t.status);
      }
      setStatuses(rawStatuses.filter((s) => s?.status != null).sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0)));
      setTasks((tasksRes?.tasks ?? []).filter((t): t is CUTask => t?.id != null));

      if (resolvedListId) {
        try {
          const membersRes = await clickupApi.getListMembers(resolvedListId);
          setMembers(
            (membersRes?.members ?? [])
              .map((m) => m?.user)
              .filter((u): u is CUMember => u?.id != null),
          );
        } catch {
          // members are optional
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      if (msg === "clickup_not_configured") {
        setNotConfigured(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [viewId]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, CUTask[]> = {};
    for (const s of statuses) map[s.status] = [];
    for (const t of tasks) {
      const key = t.status?.status;
      if (!key) continue;
      if (!map[key]) map[key] = [];
      const assigneeMatch = filterAssignee === "__all__" || (t.assignees ?? []).some((a) => String(a?.id) === filterAssignee);
      if (assigneeMatch) map[key].push(t);
    }
    return map;
  }, [tasks, statuses, filterAssignee]);

  function handleDragStart(e: DragStartEvent) {
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const overTask = tasks.find((t) => t.id === over.id);
    const overStatus = statuses.find((s) => s.status === over.id);
    const targetStatus = overTask?.status.status ?? overStatus?.status;
    if (!targetStatus) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? { ...t, status: statuses.find((s) => s.status === targetStatus) ?? t.status }
          : t,
      ),
    );
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const overTask = tasks.find((t) => t.id === over.id);
    const overStatus = statuses.find((s) => s.status === over.id);
    const targetStatus = overTask?.status.status ?? overStatus?.status;
    if (!targetStatus || targetStatus === task.status.status) return;

    try {
      await clickupApi.updateTask(task.id, { status: targetStatus });
    } catch {
      toast.error("Erro ao mover tarefa no ClickUp");
      void loadBoard();
    }
  }

  async function handleSaveTask(taskId: string, updates: { name?: string; description?: string; status?: string; due_date?: number | null }) {
    try {
      await clickupApi.updateTask(taskId, updates);
      toast.success("Tarefa atualizada");
      void loadBoard();
    } catch {
      toast.error("Erro ao atualizar tarefa");
    }
  }

  async function handleCreateTask(lid: string, payload: { name: string; status?: string; description?: string }) {
    try {
      await clickupApi.createTask(lid, payload);
      toast.success("Tarefa criada");
      void loadBoard();
    } catch {
      toast.error("Erro ao criar tarefa");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!viewId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-40" />
        <p className="font-semibold text-foreground">View ID não configurado</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Configure o View ID do board em Settings → Integrações para carregar o Astra Numèrica.
        </p>
        <Link href="/settings?tab=integracoes">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Abrir configurações
          </Button>
        </Link>
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-40" />
        <p className="font-semibold text-foreground">ClickUp não configurado</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Configure seu Personal API Token e o View ID em Settings → Integrações.
        </p>
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Abrir configurações
          </Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="font-semibold text-foreground">Erro ao carregar board</p>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={loadBoard}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {members.length > 0 && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os membros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os membros</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={loadBoard}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!listId}>
          <Plus className="mr-2 h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => (
            <Column
              key={status.status}
              status={status}
              tasks={tasksByStatus[status.status] ?? []}
              onTaskClick={setDetailTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} overlay />}
        </DragOverlay>
      </DndContext>

      <TaskDetailDialog
        task={detailTask}
        statuses={statuses}
        members={members}
        onClose={() => setDetailTask(null)}
        onSave={handleSaveTask}
      />

      <CreateTaskDialog
        open={createOpen}
        statuses={statuses}
        listId={listId}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateTask}
      />
    </div>
  );
}
