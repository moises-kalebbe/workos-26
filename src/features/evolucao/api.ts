import { db } from "@/lib/dbClient";
import { getDailyReflectionDateKey } from "@/lib/dailyReflection";
import type { EvolucaoEntry, EvolucaoPrompt, EvolucaoSetting, EvolucaoMood } from "@/features/evolucao/types";

export const evolucaoApi = {
  db,
  async getTimezone() {
    return db.from("profiles").select("timezone").maybeSingle();
  },
  async getPrompts() {
    return db.from("daily_reflection_prompts").select("*").order("position");
  },
  async getSettings() {
    return db.from("daily_reflection_settings").select("*").maybeSingle();
  },
  async getEntries() {
    return db.from("daily_reflection_entries").select("*").order("entry_date", { ascending: false });
  },
  async ensureSettings(userId: string, timezone: string, now: Date) {
    const existing = await evolucaoApi.getSettings();
    if (existing.error || existing.data) {
      return existing as { data: EvolucaoSetting | null; error: { message: string } | null };
    }

    const created = await db
      .from("daily_reflection_settings")
      .insert({
        user_id: userId,
        rotation_started_on: getDailyReflectionDateKey(now, timezone),
      })
      .select("*")
      .single();

    if (!created.error) {
      return created as { data: EvolucaoSetting | null; error: { message: string } | null };
    }

    return evolucaoApi.getSettings() as Promise<{ data: EvolucaoSetting | null; error: { message: string } | null }>;
  },
  async saveEntry({
    entryId,
    userId,
    entryDate,
    promptId,
    actionsTakenMd,
    selfRating,
    mood,
  }: {
    entryId?: string | null;
    userId: string;
    entryDate: string;
    promptId: string;
    actionsTakenMd: string;
    selfRating: number;
    mood: EvolucaoMood;
  }) {
    const payload = {
      user_id: userId,
      entry_date: entryDate,
      prompt_id: promptId,
      actions_taken_md: actionsTakenMd.trim(),
      self_rating: selfRating,
      mood,
    };

    const query = entryId
      ? db.from("daily_reflection_entries").update(payload).eq("id", entryId)
      : db.from("daily_reflection_entries").insert(payload);

    return query.select("*").single() as Promise<{ data: EvolucaoEntry | null; error: { message: string } | null }>;
  },
};
