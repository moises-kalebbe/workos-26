import type {
  DailyReflectionChecklistEntry,
  DailyReflectionEntry,
  DailyReflectionMood,
  DailyReflectionPrompt,
  DailyReflectionSetting,
} from "@/types";

export type EvolucaoPrompt = DailyReflectionPrompt;
export type EvolucaoSetting = DailyReflectionSetting;
export type EvolucaoEntry = DailyReflectionEntry;
export type EvolucaoMood = DailyReflectionMood;

export type EvolucaoDraft = {
  checklist: DailyReflectionChecklistEntry[];
  actionsTakenMd: string;
  tomorrowFocus: string;
  selfRating: string;
  mood: EvolucaoMood | "";
};

export type EvolucaoHistoryItem = EvolucaoEntry & {
  prompt: EvolucaoPrompt | null;
};

export const EVOLUCAO_MOOD_OPTIONS: Array<{
  value: EvolucaoMood;
  label: string;
  tone: string;
}> = [
  { value: "excellent", label: "Excelente", tone: "text-emerald-300" },
  { value: "good", label: "Bem", tone: "text-cyan-300" },
  { value: "neutral", label: "Neutro", tone: "text-slate-300" },
  { value: "tired", label: "Cansado", tone: "text-amber-300" },
  { value: "heavy", label: "Pesado", tone: "text-rose-300" },
];

export const EVOLUCAO_RATING_OPTIONS = [1, 2, 3, 4, 5];
