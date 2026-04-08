import type { EisenhowerQuadrant, Task } from "@/types";

type MatrixTaskLike = Pick<Task, "priority" | "due_date"> &
  Partial<Pick<Task, "urgency" | "importance">> & {
    title?: string;
  };

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function normalizeUrgency(task: MatrixTaskLike): "urgent" | "not_urgent" {
  if (task.urgency === "urgent" || task.urgency === "not_urgent") {
    return task.urgency;
  }

  if (task.priority === "urgent") {
    return "urgent";
  }

  if (!task.due_date) {
    return "not_urgent";
  }

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate = new Date(task.due_date);

  if (Number.isNaN(dueDate.getTime())) {
    return "not_urgent";
  }

  return dueDate <= todayDateOnly ? "urgent" : "not_urgent";
}

function normalizeImportance(task: MatrixTaskLike): "important" | "not_important" {
  if (task.importance === "important" || task.importance === "not_important") {
    return task.importance;
  }

  return task.priority === "low" ? "not_important" : "important";
}

export function getQuadrant(task: MatrixTaskLike): EisenhowerQuadrant {
  const urgency = normalizeUrgency(task);
  const importance = normalizeImportance(task);

  if (urgency === "urgent" && importance === "important") {
    return "do_now";
  }

  if (urgency === "not_urgent" && importance === "important") {
    return "schedule";
  }

  if (urgency === "urgent" && importance === "not_important") {
    return "delegate";
  }

  return "eliminate";
}

export function toTaskFields(quadrant: EisenhowerQuadrant): Pick<Task, "urgency" | "importance"> {
  switch (quadrant) {
    case "do_now":
      return { urgency: "urgent", importance: "important" };
    case "schedule":
      return { urgency: "not_urgent", importance: "important" };
    case "delegate":
      return { urgency: "urgent", importance: "not_important" };
    case "eliminate":
      return { urgency: "not_urgent", importance: "not_important" };
    default:
      return { urgency: "not_urgent", importance: "important" };
  }
}

export function sortTasksForMatrix<T extends MatrixTaskLike>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.normal;
    const priorityB = PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.normal;
    if (priorityA !== priorityB) return priorityA - priorityB;

    const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;

    return (a.title || "").localeCompare(b.title || "", "pt-BR");
  });
}

export function groupByQuadrant<T extends MatrixTaskLike>(tasks: T[]): Record<EisenhowerQuadrant, T[]> {
  const groups: Record<EisenhowerQuadrant, T[]> = {
    do_now: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };

  sortTasksForMatrix(tasks).forEach((task) => {
    groups[getQuadrant(task)].push(task);
  });

  return groups;
}

