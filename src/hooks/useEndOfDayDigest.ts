"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { db } from "@/lib/dbClient";

const STORAGE_KEY = "workos_eod_digest_date";
const TRIGGER_HOUR = 18;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ""}`;
  return `${m}min`;
}

function formatMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function useEndOfDayDigest(userId: string | null) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    async function check() {
      if (firedRef.current) return;
      const today = todayIso();
      if (localStorage.getItem(STORAGE_KEY) === today) return;
      if (new Date().getHours() < TRIGGER_HOUR) return;

      firedRef.current = true;
      localStorage.setItem(STORAGE_KEY, today);

      const startOfDay = `${today}T00:00:00`;
      const [sessionRes, taskRes] = await Promise.all([
        (db as any)
          .from("time_sessions")
          .select("duration_seconds, project:projects(hourly_rate)")
          .eq("user_id", userId)
          .gte("started_at", startOfDay)
          .not("ended_at", "is", null),
        (db as any)
          .from("tasks")
          .select("id")
          .eq("user_id", userId)
          .eq("column_index", 2)
          .gte("completed_at", startOfDay),
      ]);

      const sessions = sessionRes.data || [];
      const totalSeconds = sessions.reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);
      const totalValue = sessions.reduce((acc: number, s: any) => {
        const rate = s.project?.hourly_rate || 0;
        return acc + (s.duration_seconds || 0) / 3600 * rate;
      }, 0);
      const completedTasks = (taskRes.data || []).length;

      if (totalSeconds < 60) return;

      const parts: string[] = [`${formatDuration(totalSeconds)} trabalhados`];
      if (totalValue > 0) parts.push(formatMoney(totalValue) + " gerados");
      if (completedTasks > 0) parts.push(`${completedTasks} tarefa(s) concluída(s)`);

      toast.success("Resumo do dia", {
        description: parts.join(" · "),
        duration: 10000,
        action: {
          label: "Registrar reflexão",
          onClick: () => window.open("/evolucao", "_self"),
        },
      });
    }

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);
}
