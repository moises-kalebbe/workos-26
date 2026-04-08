import { getDateKeyInTimezone } from "@/lib/timeline";

export type DailyReflectionPromptLike = {
  id: string;
  position: number;
  title: string;
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
