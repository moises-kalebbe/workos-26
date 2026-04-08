import React, { useState, useEffect, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Check, Trash2, Pencil, Copy, BookOpen, Search, Activity, Clock3, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
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
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import type { Task, Subtask, Project, SkillDocument, EisenhowerQuadrant } from "@/types";

const COLUMNS = [
  { index: 0, title: "A Fazer", color: "border-t-warning" },
  { index: 1, title: "Em Andamento", color: "border-t-info" },
  { index: 2, title: "Concluido", color: "border-t-success" },
];

const NO_SKILL_VALUE = "__no_skill__";

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


const TaskCard = React.memo(({ task, companyLabel, skill, onMove, onToggleSubtask, onAddSubtask, onDelete, onEdit, onPreviewSkill, onCopySkill }: {
  task: Task;
  companyLabel: string | null;
  skill: SkillDocument | null;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggleSubtask: (subtaskId: string, completed: boolean) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onPreviewSkill: (skill: SkillDocument) => void;
  onCopySkill: (skill: SkillDocument) => void;
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
      className="group cursor-grab rounded-xl border border-border/80 bg-[linear-gradient(180deg,rgba(22,28,42,0.98),rgba(16,22,34,0.98))] p-4 transition-all hover:border-primary/25 hover:bg-card active:cursor-grabbing"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {priority ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priority.className)}>
                {priority.label}
              </span>
            ) : null}
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", quadrant.className)}>
              {quadrant.label}
            </span>
            {companyLabel ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {companyLabel}
              </span>
            ) : null}
          </div>
          <p className="text-[15px] font-semibold leading-5 text-foreground">{task.title}</p>
          {task.due_date ? (
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className={cn(
                "text-muted-foreground",
                new Date(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0) && "text-danger",
              )}>
                Prazo {new Date(task.due_date).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => onEdit(task)} className="p-1 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1 text-muted-foreground hover:text-danger">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {skill ? (
        <div
          className="mb-3 rounded-lg border border-primary/15 bg-background/70 px-2.5 py-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Skill vinculada</p>
              <button
                type="button"
                onClick={() => onPreviewSkill(skill)}
                className="mt-1 text-left text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {skill.title}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPreviewSkill(skill)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={`Abrir skill ${skill.title}`}
              >
                <BookOpen className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCopySkill(skill)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={`Copiar skill ${skill.title}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {skill.summary ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{skill.summary}</p>
          ) : null}
        </div>
      ) : null}

      {/* Subtasks */}
      {subtasks.length > 0 ? (
        <div className="mt-3 space-y-1.5 rounded-lg border border-border/60 bg-background/30 p-3">
          <div className="mb-1 flex items-center gap-2">
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
  const router = useRouter();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [skills, setSkills] = useState<SkillDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [skillPreviewOpen, setSkillPreviewOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [previewSkill, setPreviewSkill] = useState<SkillDocument | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newProjectValue, setNewProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [newPriority, setNewPriority] = useState<Task["priority"]>("normal");
  const [newUrgency, setNewUrgency] = useState<Task["urgency"]>("not_urgent");
  const [newImportance, setNewImportance] = useState<Task["importance"]>("important");
  const [newDueDate, setNewDueDate] = useState("");
  const [newSkillValue, setNewSkillValue] = useState(NO_SKILL_VALUE);

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editProjectValue, setEditProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [editPriority, setEditPriority] = useState<Task["priority"]>("normal");
  const [editUrgency, setEditUrgency] = useState<Task["urgency"]>("not_urgent");
  const [editImportance, setEditImportance] = useState<Task["importance"]>("important");
  const [editDueDate, setEditDueDate] = useState("");
  const [editSkillValue, setEditSkillValue] = useState(NO_SKILL_VALUE);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [tasksRes, projRes, skillsRes] = await Promise.all([
        db.from("tasks").select("*").order("position"),
        db.from("projects").select("*").order("name"),
        db.from("skill_documents").select("*").order("title"),
      ]);

      if (tasksRes.error) {
        throw new Error(tasksRes.error.message);
      }

      if (projRes.error) {
        console.error("[kanban] failed to load projects", projRes.error.message);
        toast.error(`Projetos indisponiveis: ${projRes.error.message}`);
        setProjects([]);
      } else {
        setProjects((projRes.data || []) as unknown as Project[]);
      }

      if (skillsRes.error) {
        console.error("[kanban] failed to load skills", skillsRes.error.message);
        toast.error(`Skills indisponiveis: ${skillsRes.error.message}`);
        setSkills([]);
      } else {
        setSkills((skillsRes.data || []) as unknown as SkillDocument[]);
      }

      const tasksList = (tasksRes.data || []) as unknown as Task[];

      if (tasksList.length > 0) {
        const taskIds = tasksList.map((t) => t.id);
        const { data: subtasksData, error: subtasksError } = await db
          .from("subtasks")
          .select("*")
          .in("task_id", taskIds)
          .order("position");

        if (subtasksError) {
          console.error("[kanban] failed to load subtasks", subtasksError.message);
          toast.error(`Subtarefas indisponiveis: ${subtasksError.message}`);
        }

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
      const message = error instanceof Error ? error.message : "Erro ao carregar dados do Kanban";
      setLoadError(message);
      setTasks([]);
      toast.error(`Erro ao carregar Kanban: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function createTask() {
    if (!newTitle || !user) return;
    const projectId = projectIdFromSelectValue(newProjectValue);
    const selectedProject = projects.find((project) => project.id === projectId) || null;
    const skillDocumentId = newSkillValue === NO_SKILL_VALUE ? null : newSkillValue;
    const maxPos = Math.max(0, ...tasks.filter((t) => t.column_index === 0).map((t) => t.position));
    const { error } = await db.from("tasks").insert({
      user_id: user.id,
      title: newTitle,
      project_id: projectId,
      skill_document_id: skillDocumentId,
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
      setNewSkillValue(NO_SKILL_VALUE);
      loadData();
    }
  }

  async function updateTask() {
    if (!editingTask || !editTitle) return;
    const projectId = projectIdFromSelectValue(editProjectValue);
    const selectedProject = projects.find((project) => project.id === projectId) || null;
    const skillDocumentId = editSkillValue === NO_SKILL_VALUE ? null : editSkillValue;
    const { error } = await db.from("tasks").update({
      title: editTitle,
      project_id: projectId,
      skill_document_id: skillDocumentId,
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
    await db.from("subtasks").delete().eq("task_id", taskId);
    const { error } = await db.from("tasks").delete().eq("id", taskId);
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
    setEditSkillValue(task.skill_document_id || NO_SKILL_VALUE);
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
    await db.from("tasks").update({ column_index: newCol }).eq("id", taskId);
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
    await db.from("subtasks").update({ completed }).eq("id", subtaskId);
  }

  async function addSubtask(taskId: string, title: string) {
    const maxPos = Math.max(
      0,
      ...(tasks.find((t) => t.id === taskId)?.subtasks?.map((s) => s.position) || [0])
    );
    const { data } = await db
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

  function openSkillPreview(skill: SkillDocument) {
    setPreviewSkill(skill);
    setSkillPreviewOpen(true);
  }

  async function copySkillToClipboard(skill: SkillDocument) {
    try {
      await navigator.clipboard.writeText(skill.content_md);
      toast.success(`Skill "${skill.title}" copiada`);
    } catch {
      toast.error("Não foi possível copiar a skill");
    }
  }

  function openSkillInLibrary(skill: SkillDocument) {
    router.push(`/skills?skill=${encodeURIComponent(skill.id)}`);
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
    await db.from("tasks").update({ column_index: activeTask.column_index }).eq("id", String(active.id));
  }

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const skillMap = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const newProjectId = projectIdFromSelectValue(newProjectValue);
  const editProjectId = projectIdFromSelectValue(editProjectValue);

  const newSkillOptions = useMemo(
    () => skills.filter((skill) => {
      if (newSkillValue !== NO_SKILL_VALUE && skill.id === newSkillValue) return true;
      return skill.project_id === null || skill.project_id === newProjectId;
    }),
    [newProjectId, newSkillValue, skills]
  );
  const editSkillOptions = useMemo(
    () => skills.filter((skill) => {
      if (editSkillValue !== NO_SKILL_VALUE && skill.id === editSkillValue) return true;
      return skill.project_id === null || skill.project_id === editProjectId;
    }),
    [editProjectId, editSkillValue, skills]
  );

  const selectedNewSkill = newSkillValue === NO_SKILL_VALUE ? null : skillMap.get(newSkillValue) || null;
  const selectedEditSkill = editSkillValue === NO_SKILL_VALUE ? null : skillMap.get(editSkillValue) || null;

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      const projectName = task.project_id ? projectMap.get(task.project_id)?.name || task.client || "" : task.client || "";
      const skillTitle = task.skill_document_id ? skillMap.get(task.skill_document_id)?.title || "" : "";
      const matchesSearch =
        !normalizedSearch ||
        task.title.toLowerCase().includes(normalizedSearch) ||
        projectName.toLowerCase().includes(normalizedSearch) ||
        skillTitle.toLowerCase().includes(normalizedSearch);

      const matchesProject = projectFilter === "all" || (projectFilter === GENERAL_PROJECT_VALUE
        ? !task.project_id
        : task.project_id === projectFilter);
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesProject && matchesPriority;
    });
  }, [priorityFilter, projectFilter, projectMap, searchQuery, skillMap, tasks]);

  const boardSummary = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
    const openTasks = filteredTasks.filter((task) => task.column_index < 2);
    const overdueCount = openTasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0)).length;
    const dueTodayCount = openTasks.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      const now = new Date();
      return dueDate.getFullYear() === now.getFullYear() && dueDate.getMonth() === now.getMonth() && dueDate.getDate() === now.getDate();
    }).length;

    const recommendedTask = [...openTasks].sort((a, b) => {
      const aQuadrant = getQuadrant(a);
      const bQuadrant = getQuadrant(b);
      const quadrantOrder = { do_now: 0, schedule: 1, delegate: 2, eliminate: 3 } as const;
      if (quadrantOrder[aQuadrant] !== quadrantOrder[bQuadrant]) return quadrantOrder[aQuadrant] - quadrantOrder[bQuadrant];
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })[0] || null;

    return {
      openCount: openTasks.length,
      inProgressCount: filteredTasks.filter((task) => task.column_index === 1).length,
      completedCount: filteredTasks.filter((task) => task.column_index === 2).length,
      overdueCount,
      dueTodayCount,
      recommendedTask,
    };
  }, [filteredTasks]);

  const signedInEmail = user?.primaryEmailAddress?.emailAddress || null;

  if (loading) {
    return <LoadingState message="Carregando quadro Kanban..." />;
  }

  return (
    <div className="space-y-6">
      {loadError ? (
        <div className="rounded-2xl border border-danger/30 bg-danger-muted/40 p-4">
          <p className="text-sm font-semibold text-danger">Não foi possível carregar o quadro.</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <div className="mt-3">
            <Button variant="outline" className="border-danger/30" onClick={() => void loadData()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      {!loadError && tasks.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/95 p-4">
          <p className="text-sm font-semibold text-foreground">Nenhuma tarefa encontrada para a conta atual.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {signedInEmail
              ? `Sessao ativa: ${signedInEmail}. Se esse nao for o email esperado, saia da conta e entre novamente.`
              : "Se esse não for o ambiente esperado, saia da conta e entre novamente."}
          </p>
        </div>
      ) : null}

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
                <Label className="text-xs text-muted-foreground">Título</Label>
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
                <Label className="text-xs text-muted-foreground">Skill de apoio</Label>
                <Select value={newSkillValue} onValueChange={setNewSkillValue}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Nenhuma skill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SKILL_VALUE}>Nenhuma skill</SelectItem>
                    {newSkillOptions.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id}>{skill.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedNewSkill ? (
                  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-xs font-medium text-foreground">{selectedNewSkill.title}</p>
                    {selectedNewSkill.summary ? (
                      <p className="mt-1 text-xs text-muted-foreground">{selectedNewSkill.summary}</p>
                    ) : null}
                  </div>
                ) : null}
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
              <Label className="text-xs text-muted-foreground">Título</Label>
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
              <Label className="text-xs text-muted-foreground">Skill de apoio</Label>
              <Select value={editSkillValue} onValueChange={setEditSkillValue}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Nenhuma skill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SKILL_VALUE}>Nenhuma skill</SelectItem>
                  {editSkillOptions.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>{skill.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEditSkill ? (
                <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-xs font-medium text-foreground">{selectedEditSkill.title}</p>
                  {selectedEditSkill.summary ? (
                    <p className="mt-1 text-xs text-muted-foreground">{selectedEditSkill.summary}</p>
                  ) : null}
                </div>
              ) : null}
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

      <Dialog
        open={skillPreviewOpen}
        onOpenChange={(open) => {
          setSkillPreviewOpen(open);
          if (!open) setPreviewSkill(null);
        }}
      >
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>{previewSkill?.title || "Skill"}</DialogTitle>
            <DialogDescription>
              {previewSkill?.summary || "Visualize ou copie o conteúdo da skill vinculada."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    if (previewSkill) openSkillInLibrary(previewSkill);
                  }}
                  disabled={!previewSkill}
                >
                  <BookOpen className="h-4 w-4" />
                  Abrir na biblioteca
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    if (previewSkill) void copySkillToClipboard(previewSkill);
                  }}
                  disabled={!previewSkill}
                >
                  <Copy className="h-4 w-4" />
                  Copiar skill
                </Button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-background p-4">
              <article className="prose prose-sm max-w-none prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {previewSkill?.content_md || ""}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.9fr_0.9fr_0.9fr]">
        <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(8,18,38,0.96),rgba(15,25,44,0.92))] p-5 shadow-[0_20px_60px_-40px_rgba(34,211,238,0.5)]">
          <div className="flex items-center gap-2 text-cyan-200/80">
            <Activity className="h-4 w-4 text-cyan-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Foco recomendado</p>
          </div>
          <div className="mt-3">
            <p className="text-lg font-semibold text-foreground">
              {boardSummary.recommendedTask?.title || "Nenhuma tarefa aberta no momento"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {boardSummary.recommendedTask
                ? `${boardSummary.recommendedTask.project_id ? projectMap.get(boardSummary.recommendedTask.project_id)?.name || boardSummary.recommendedTask.client || "Conhecimento geral" : boardSummary.recommendedTask.client || "Conhecimento geral"} · ${QUADRANT_BADGE[getQuadrant(boardSummary.recommendedTask)].label}`
                : "Crie uma tarefa ou ajuste os filtros para montar o próximo passo."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
              {boardSummary.recommendedTask?.due_date
                ? `Prazo ${new Date(boardSummary.recommendedTask.due_date).toLocaleDateString("pt-BR")}`
                : "Sem prazo definido"}
            </span>
            <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
              {boardSummary.recommendedTask?.priority
                ? PRIORITIES.find((priority) => priority.value === boardSummary.recommendedTask?.priority)?.label || "Normal"
                : "Sem prioridade"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Abertas</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{boardSummary.openCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Tarefas fora de concluido</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Em andamento</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{boardSummary.inProgressCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Capacidade atual do board</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prazos</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{boardSummary.dueTodayCount + boardSummary.overdueCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {boardSummary.overdueCount} atrasadas · {boardSummary.dueTodayCount} vencem hoje
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/95 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Filtros do quadro</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Refine o que entra no board</h2>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tarefa, empresa ou skill"
                className="h-10 rounded-2xl border-border bg-background/60 pl-10 sm:w-[280px]"
              />
            </div>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border bg-background/60 sm:w-[210px]">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                <SelectItem value={GENERAL_PROJECT_VALUE}>Conhecimento geral</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border bg-background/60 sm:w-[180px]">
                <SelectValue placeholder="Todas as prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

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
            {col.title} ({filteredTasks.filter((t) => t.column_index === col.index).length})
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
            const columnTasks = filteredTasks.filter((t) => t.column_index === col.index);
            const isVisible = !isMobile || mobileColumn === col.index;

            if (!isVisible) return null;

            return (
              <div
                key={col.index}
                className={cn(
                  "rounded-2xl border border-border bg-card/50 p-4 border-t-[3px]",
                  col.color
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {col.index === 0 ? "Entrada e fila priorizada" : col.index === 1 ? "Execução atual do time" : "Entregas finalizadas"}
                    </p>
                  </div>
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
                      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
                        <p className="text-sm font-medium text-foreground">
                          {col.index === 0 ? "Nenhuma tarefa na fila" : col.index === 1 ? "Nada em execução agora" : "Nada concluido ainda"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {col.index === 0
                            ? "Crie uma nova tarefa ou arraste uma prioridade para ca."
                            : col.index === 1
                              ? "Mova uma tarefa para esta coluna quando for iniciar o trabalho."
                              : "As entregas finalizadas aparecem aqui automaticamente."}
                        </p>
                      </div>
                    ) : (
                      columnTasks.map((task) => {
                        const skill = task.skill_document_id ? skillMap.get(task.skill_document_id) || null : null;
                        return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          companyLabel={task.project_id ? projectMap.get(task.project_id)?.name || task.client : task.client}
                          skill={skill}
                          onMove={moveTask}
                          onToggleSubtask={toggleSubtask}
                          onAddSubtask={addSubtask}
                          onDelete={deleteTask}
                          onEdit={openEditDialog}
                          onPreviewSkill={openSkillPreview}
                          onCopySkill={copySkillToClipboard}
                        />
                        );
                      })
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




