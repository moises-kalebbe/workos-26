"use client";

import { useEffect, useState } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CheckSquare, Play, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "workos_morning_briefing_date";

type BriefingData = {
  meetingsToday: { id: string; summary: string; start: string; meetLink: string | null }[];
  urgentTasks: { id: string; title: string; project: string | null }[];
  financialAlerts: { title: string; amount: number; type: "overdue" | "due_today" }[];
  mainProjectId: string | null;
  mainProjectName: string | null;
};

function formatTime(iso: string) {
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return iso.slice(11, 16);
  }
}

function formatMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MorningBriefing() {
  const { user } = useAuth();
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<BriefingData | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = todayIso();
    if (localStorage.getItem(STORAGE_KEY) === today) return;

    const hour = new Date().getHours();
    if (hour < 5 || hour >= 13) return;

    void loadAndShow(user.id, today);
  }, [user]);

  async function loadAndShow(userId: string, today: string) {
    const todayEnd = `${today}T23:59:59`;
    const [taskRes, finRes, sessionRes, projectRes] = await Promise.all([
      (db as any)
        .from("tasks")
        .select("id, title, project_id, urgency, importance, project:projects(name)")
        .eq("user_id", userId)
        .eq("urgency", "urgent")
        .eq("importance", "important")
        .lt("column_index", 2)
        .limit(3),
      (db as any)
        .from("financial_entries")
        .select("title, amount, due_date, status")
        .eq("user_id", userId)
        .lte("due_date", todayEnd)
        .in("status", ["pending", "overdue"])
        .limit(5),
      (db as any)
        .from("time_sessions")
        .select("project_id")
        .eq("user_id", userId)
        .gte("started_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("started_at", { ascending: false })
        .limit(20),
      (db as any)
        .from("projects")
        .select("id, name")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(10),
    ]);

    const urgentTasks = (taskRes.data || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      project: t.project?.name || null,
    }));

    const financialAlerts = (finRes.data || []).map((f: any) => ({
      title: f.title,
      amount: f.amount,
      type: f.status === "overdue" || f.due_date < today ? "overdue" : "due_today",
    })) as BriefingData["financialAlerts"];

    // Find most-used project in last 2 weeks
    const projectFreq = new Map<string, number>();
    for (const s of sessionRes.data || []) {
      if (s.project_id) projectFreq.set(s.project_id, (projectFreq.get(s.project_id) || 0) + 1);
    }
    const mainProjectId = projectFreq.size > 0
      ? [...projectFreq.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;
    const mainProject = (projectRes.data || []).find((p: any) => p.id === mainProjectId);

    setData({
      meetingsToday: [],
      urgentTasks,
      financialAlerts,
      mainProjectId: mainProjectId,
      mainProjectName: mainProject?.name || null,
    });
    setOpen(true);
    localStorage.setItem(STORAGE_KEY, today);
  }

  function handleStartDay() {
    if (data?.mainProjectId && user) {
      void timer.start(data.mainProjectId, user.id);
    }
    setOpen(false);
  }

  if (!data) return null;

  const dayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const hasAlerts = data.financialAlerts.length > 0 || data.urgentTasks.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl border-border bg-card p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-[linear-gradient(135deg,rgba(8,18,38,0.98),rgba(15,25,44,0.94))] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Bom dia</p>
          <h2 className="mt-1 text-xl font-semibold capitalize text-foreground">{dayLabel}</h2>
          {data.mainProjectName && (
            <p className="mt-1 text-sm text-slate-400">
              Foco sugerido: <span className="text-cyan-300">{data.mainProjectName}</span>
            </p>
          )}
        </div>

        <div className="space-y-4 p-6">
          {/* Urgent tasks */}
          {data.urgentTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                <CheckSquare className="h-3.5 w-3.5" />
                Fazer agora
              </div>
              <ul className="space-y-1.5">
                {data.urgentTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                    <span>
                      {t.title}
                      {t.project && <span className="ml-1 text-xs text-muted-foreground">({t.project})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Financial alerts */}
          {data.financialAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning mb-2">
                <Wallet className="h-3.5 w-3.5" />
                Alertas financeiros
              </div>
              <ul className="space-y-1.5">
                {data.financialAlerts.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className={cn(f.type === "overdue" ? "text-danger" : "text-foreground")}>{f.title}</span>
                    <span className="text-xs text-muted-foreground">{formatMoney(f.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasAlerts && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sem alertas urgentes. Bom dia limpo!
            </p>
          )}

          {/* CTA */}
          <div className="flex gap-2 pt-2">
            {data.mainProjectId ? (
              <Button className="flex-1" onClick={handleStartDay}>
                <Play className="mr-2 h-4 w-4" />
                Iniciar dia em {data.mainProjectName}
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => setOpen(false)}>
                Começar o dia
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
