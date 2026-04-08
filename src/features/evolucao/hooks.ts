"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { evolucaoApi } from "@/features/evolucao/api";
import {
  EVOLUCAO_MOOD_OPTIONS,
  EVOLUCAO_RATING_OPTIONS,
  type EvolucaoDraft,
  type EvolucaoEntry,
  type EvolucaoHistoryItem,
  type EvolucaoMood,
  type EvolucaoPrompt,
  type EvolucaoSetting,
} from "@/features/evolucao/types";
import {
  getDailyReflectionDateKey,
  normalizeDailyReflectionPrompt,
  selectDailyReflectionPrompt,
} from "@/lib/dailyReflection";

const EMPTY_DRAFT: EvolucaoDraft = {
  actionsTakenMd: "",
  selfRating: "",
  mood: "",
};

export function useEvolucaoFeature({ userId }: { userId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [prompts, setPrompts] = useState<EvolucaoPrompt[]>([]);
  const [settings, setSettings] = useState<EvolucaoSetting | null>(null);
  const [entries, setEntries] = useState<EvolucaoEntry[]>([]);
  const [draft, setDraft] = useState<EvolucaoDraft>(EMPTY_DRAFT);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) {
      setPrompts([]);
      setSettings(null);
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [profileRes, promptsRes, entriesRes] = await Promise.all([
        evolucaoApi.getTimezone(),
        evolucaoApi.getPrompts(),
        evolucaoApi.getEntries(),
      ]);

      if (profileRes.error) throw new Error(profileRes.error.message);
      if (promptsRes.error) throw new Error(promptsRes.error.message);
      if (entriesRes.error) throw new Error(entriesRes.error.message);

      const effectiveTimezone = profileRes.data?.timezone || "America/Sao_Paulo";
      setTimezone(effectiveTimezone);
      setPrompts(
        ((promptsRes.data || []) as EvolucaoPrompt[]).map((prompt) => normalizeDailyReflectionPrompt(prompt) as EvolucaoPrompt),
      );
      setEntries((entriesRes.data || []) as EvolucaoEntry[]);

      const settingsRes = await evolucaoApi.ensureSettings(userId, effectiveTimezone, now);
      if (settingsRes.error) throw new Error(settingsRes.error.message);
      setSettings((settingsRes.data || null) as EvolucaoSetting | null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar o diario de evolucao.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [now, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const todayDateKey = useMemo(
    () => getDailyReflectionDateKey(now, timezone),
    [now, timezone],
  );

  const todayPrompt = useMemo(() => {
    if (!settings) return null;
    return selectDailyReflectionPrompt({
      prompts,
      rotationStartedOn: settings.rotation_started_on,
      now,
      timezone,
    });
  }, [now, prompts, settings, timezone]);

  const promptMap = useMemo(
    () => new Map(prompts.map((prompt) => [prompt.id, prompt])),
    [prompts],
  );

  const todayEntry = useMemo(
    () => entries.find((entry) => entry.entry_date === todayDateKey) || null,
    [entries, todayDateKey],
  );

  const history = useMemo<EvolucaoHistoryItem[]>(() => {
    return [...entries]
      .sort((left, right) => right.entry_date.localeCompare(left.entry_date))
      .map((entry) => ({
        ...entry,
        prompt: promptMap.get(entry.prompt_id) || null,
      }));
  }, [entries, promptMap]);

  useEffect(() => {
    setDraft({
      actionsTakenMd: todayEntry?.actions_taken_md || "",
      selfRating: todayEntry ? String(todayEntry.self_rating) : "",
      mood: (todayEntry?.mood || "") as EvolucaoMood | "",
    });
  }, [todayEntry?.actions_taken_md, todayEntry?.id, todayEntry?.mood, todayEntry?.self_rating, todayDateKey]);

  const updateDraft = useCallback((patch: Partial<EvolucaoDraft>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }, []);

  const saveTodayEntry = useCallback(async () => {
    if (!userId || !todayPrompt) return;

    const actionsTakenMd = draft.actionsTakenMd.trim();
    const selfRating = Number.parseInt(draft.selfRating, 10);
    const mood = draft.mood;

    if (!actionsTakenMd) {
      toast.error("Escreva quais acoes voce tomou hoje.");
      return;
    }

    if (!Number.isInteger(selfRating) || selfRating < 1 || selfRating > 5) {
      toast.error("Escolha uma nota de 1 a 5.");
      return;
    }

    if (!mood) {
      toast.error("Escolha como voce terminou o dia.");
      return;
    }

    setSaving(true);

    try {
      const response = await evolucaoApi.saveEntry({
        entryId: todayEntry?.id || null,
        userId,
        entryDate: todayDateKey,
        promptId: todayPrompt.id,
        actionsTakenMd,
        selfRating,
        mood,
      });

      if (response.error || !response.data) {
        throw new Error(response.error?.message || "Falha ao salvar registro do dia.");
      }

      setEntries((current) => {
        const next = current.filter((entry) => entry.id !== response.data?.id && entry.entry_date !== response.data?.entry_date);
        return [response.data as EvolucaoEntry, ...next];
      });
      toast.success("Registro de evolucao salvo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar registro do dia.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [draft.actionsTakenMd, draft.mood, draft.selfRating, todayDateKey, todayEntry?.id, todayPrompt, userId]);

  return {
    draft,
    history,
    loading,
    moodOptions: EVOLUCAO_MOOD_OPTIONS,
    ratingOptions: EVOLUCAO_RATING_OPTIONS,
    saving,
    settings,
    timezone,
    todayDateKey,
    todayEntry,
    todayPrompt,
    updateDraft,
    saveTodayEntry,
    reload: loadData,
  };
}
