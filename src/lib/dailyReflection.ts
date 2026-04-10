import { getDateKeyInTimezone } from "@/lib/timeline";
import type {
  DailyReflectionChecklistEntry,
  DailyReflectionEntry,
  DailyReflectionPrompt,
} from "@/types";

export type DailyReflectionPromptLike = {
  id: string;
  position: number;
  title: string;
  application_hint?: string;
};

type DailyReflectionPromptRecord = {
  id: string;
  position: number | string;
  title: string;
  score: number | string;
  summary: string;
  application_hint: string;
  created_at: string;
  updated_at: string;
};

type DailyReflectionEntryRecord = Omit<
  DailyReflectionEntry,
  "checklist_json" | "tomorrow_focus"
> & {
  checklist_json?: unknown;
  tomorrow_focus?: string | null;
};

function parseDateKeyToUtc(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));
  return Date.UTC(year, month - 1, day);
}

export function getDailyReflectionDateKey(now: Date, timezone: string) {
  return getDateKeyInTimezone(now, timezone);
}

export function getDailyReflectionDayOffset({
  rotationStartedOn,
  now,
  timezone,
}: {
  rotationStartedOn: string;
  now: Date;
  timezone: string;
}) {
  const todayKey = getDailyReflectionDateKey(now, timezone);
  const startUtc = parseDateKeyToUtc(rotationStartedOn);
  const todayUtc = parseDateKeyToUtc(todayKey);
  return Math.max(0, Math.floor((todayUtc - startUtc) / 86400000));
}

export function selectDailyReflectionPrompt<T extends DailyReflectionPromptLike>({
  prompts,
  rotationStartedOn,
  now,
  timezone,
}: {
  prompts: T[];
  rotationStartedOn: string;
  now: Date;
  timezone: string;
}) {
  if (prompts.length === 0) return null;

  const offset = getDailyReflectionDayOffset({
    rotationStartedOn,
    now,
    timezone,
  });

  const sortedPrompts = [...prompts].sort((left, right) => left.position - right.position);
  return sortedPrompts[offset % sortedPrompts.length] || null;
}

export function normalizeDailyReflectionPrompt<T extends DailyReflectionPromptRecord>(prompt: T) {
  return {
    ...prompt,
    position: Number.parseInt(String(prompt.position), 10),
    score: Number.parseFloat(String(prompt.score)),
  };
}

function isChecklistEntry(value: unknown): value is DailyReflectionChecklistEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.completed === "boolean"
  );
}

export function normalizeDailyReflectionChecklist(
  value: unknown,
): DailyReflectionChecklistEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isChecklistEntry)
    .map((entry) => ({
      id: entry.id,
      title: entry.title.trim(),
      completed: entry.completed,
    }))
    .filter((entry) => entry.title.length > 0);
}

export function buildDailyReflectionChecklist(
  prompt: Pick<DailyReflectionPrompt, "id" | "title" | "application_hint">,
): DailyReflectionChecklistEntry[] {
  const normalizedTitle = prompt.title.trim();
  const normalizedHint = prompt.application_hint.trim();

  return [
    {
      id: `${prompt.id}:context`,
      title: `Definir onde voce vai aplicar "${normalizedTitle}" hoje.`,
      completed: false,
    },
    {
      id: `${prompt.id}:action`,
      title: normalizedHint.endsWith(".") ? normalizedHint : `${normalizedHint}.`,
      completed: false,
    },
    {
      id: `${prompt.id}:review`,
      title: "Registrar no fim do dia o que funcionou e o que precisa ajustar.",
      completed: false,
    },
  ];
}

export function getDailyReflectionChecklist({
  prompt,
  storedChecklist,
}: {
  prompt: Pick<DailyReflectionPrompt, "id" | "title" | "application_hint"> | null;
  storedChecklist: unknown;
}) {
  const normalizedChecklist = normalizeDailyReflectionChecklist(storedChecklist);
  if (normalizedChecklist.length > 0) return normalizedChecklist;
  if (!prompt) return [];
  return buildDailyReflectionChecklist(prompt);
}

export function countCompletedDailyReflectionChecklistItems(
  checklist: DailyReflectionChecklistEntry[],
) {
  return checklist.filter((item) => item.completed).length;
}

export function normalizeDailyReflectionEntry<T extends DailyReflectionEntryRecord>(entry: T) {
  return {
    ...entry,
    checklist_json: normalizeDailyReflectionChecklist(entry.checklist_json),
    tomorrow_focus: entry.tomorrow_focus?.trim() || "",
  };
}
