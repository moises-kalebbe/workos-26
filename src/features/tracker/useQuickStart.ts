import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { trackQuickStartEvent } from "@/features/tracker/analytics";
import { createQuickStartFallbackTaskAndStart, executeQuickStartFlow } from "@/features/tracker/quickStart";

type QuickStartProjectOption = {
  id: string;
  name: string;
};

type StartTimerOptions = {
  origin?: "quick_start" | "manual";
  requestId?: string;
  taskId?: string;
};

type QuickStartTimer = {
  start: (
    projectId: string,
    userId: string,
    options?: StartTimerOptions,
  ) => Promise<{ id: string } | null>;
};

function parseMinScoreOverride(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const value = new URLSearchParams(window.location.search).get("quickStartMinScore");
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function buildFallbackTitle(now: Date): string {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `Foco rapido ${hh}:${mm}`;
}

export function useQuickStart(params: {
  db: SupabaseClient;
  userId?: string;
  timer: QuickStartTimer;
  projects: QuickStartProjectOption[];
  onSessionStarted?: () => void | Promise<void>;
}) {
  const { db, userId, timer, projects, onSessionStarted } = params;
  const [isStarting, setIsStarting] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [isFallbackDialogOpen, setFallbackDialogOpen] = useState(false);
  const [isFallbackStarting, setIsFallbackStarting] = useState(false);
  const [fallbackTitle, setFallbackTitle] = useState("");
  const [fallbackProjectId, setFallbackProjectId] = useState<string>("auto");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === fallbackProjectId),
    [fallbackProjectId, projects],
  );

  useEffect(() => {
    if (projects.length === 0) {
      setFallbackProjectId("auto");
      return;
    }
    if (fallbackProjectId === "auto") return;
    if (selectedProject) return;
    setFallbackProjectId(projects[0].id);
  }, [fallbackProjectId, projects, selectedProject]);

  const triggerQuickStart = useCallback(async () => {
    if (!userId) return;
    setIsStarting(true);
    setShowRetry(false);

    try {
      const result = await executeQuickStartFlow({
        db,
        userId,
        timer,
        minScore: parseMinScoreOverride(),
      });

      if (!result.ok) {
        setFallbackTitle(buildFallbackTitle(new Date()));
        setFallbackDialogOpen(true);
        toast.info("Sem sugestao valida. Crie uma tarefa rapida para iniciar o foco.");
        return;
      }

      toast.success(`Sessao iniciada em: ${result.suggestion.task.title}`);
      await onSessionStarted?.();
    } catch {
      setShowRetry(true);
      toast.error("Falha ao iniciar foco rapido.");
    } finally {
      setIsStarting(false);
    }
  }, [db, onSessionStarted, timer, userId]);

  const retryQuickStart = useCallback(async () => {
    if (!userId) return;
    await trackQuickStartEvent({
      db,
      userId,
      eventName: "quick_start_retry_clicked",
    });
    await triggerQuickStart();
  }, [db, triggerQuickStart, userId]);

  const submitFallbackTask = useCallback(async () => {
    if (!userId) return;
    setIsFallbackStarting(true);
    setShowRetry(false);

    try {
      const result = await createQuickStartFallbackTaskAndStart({
        db,
        userId,
        timer,
        taskTitle: fallbackTitle,
        preferredProjectId: fallbackProjectId === "auto" ? null : fallbackProjectId,
      });

      setFallbackDialogOpen(false);
      toast.success(`Sessao iniciada com tarefa rapida: ${result.taskTitle}`);
      await onSessionStarted?.();
    } catch {
      setShowRetry(true);
      toast.error("Falha ao criar tarefa rapida.");
    } finally {
      setIsFallbackStarting(false);
    }
  }, [db, fallbackProjectId, fallbackTitle, onSessionStarted, timer, userId]);

  return {
    isStarting,
    showRetry,
    triggerQuickStart,
    retryQuickStart,
    isFallbackDialogOpen,
    setFallbackDialogOpen,
    fallbackTitle,
    setFallbackTitle,
    fallbackProjectId,
    setFallbackProjectId,
    isFallbackStarting,
    submitFallbackTask,
    hasProjects: projects.length > 0,
  };
}
