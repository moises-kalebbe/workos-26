"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCircle2, MoonStar, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_REMINDER_OPTIONS } from "@/features/notifications/defaults";
import { useNotificationCenter } from "@/features/notifications/context";
import type { NotificationPreferences } from "@/features/notifications/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatPermissionLabel(permission: ReturnType<typeof useNotificationCenter>["permission"]) {
  switch (permission) {
    case "granted":
      return "Permitido";
    case "denied":
      return "Bloqueado";
    case "default":
      return "Pendente";
    default:
      return "Indisponivel";
  }
}

function formatDateLabel(value: string | null) {
  if (!value) return "Ainda nao executado";

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationPreferencesCard() {
  const {
    ready,
    saving,
    permission,
    preferences,
    suppressed,
    lastEvaluatedAt,
    lastDeliveredAt,
    requestPermission,
    savePreferences,
    resetPreferences,
    sendTestNotification,
  } = useNotificationCenter();

  const [draft, setDraft] = useState<NotificationPreferences>(preferences);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const hasChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(preferences),
    [draft, preferences],
  );

  const toggleReminderMinute = (minute: number) => {
    setDraft((current) => {
      const nextValues = current.meeting_reminder_minutes.includes(minute)
        ? current.meeting_reminder_minutes.filter((item) => item !== minute)
        : [...current.meeting_reminder_minutes, minute];

      return {
        ...current,
        meeting_reminder_minutes: nextValues.sort((left, right) => right - left),
      };
    });
  };

  const handleSave = async () => {
    try {
      await savePreferences(draft);
      toast.success("Preferencias de notificacao salvas.");
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar notificacoes.");
    }
  };

  const handleReset = async () => {
    try {
      await resetPreferences();
      toast.success("Preferencias de notificacao restauradas.");
    } catch (error) {
      toast.error((error as Error).message || "Falha ao restaurar notificacoes.");
    }
  };

  const handlePermission = async () => {
    const next = await requestPermission();
    if (next === "granted") {
      toast.success("Permissao de notificacao concedida.");
      return;
    }

    if (next === "denied") {
      toast.error("Permissao bloqueada no navegador.");
      return;
    }

    if (next === "unsupported") {
      toast.error("Este navegador nao suporta notificacoes.");
    }
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-border bg-card/95 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Notificacoes</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Alertas de reuniao, financeiro e tarefas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O sistema roda dentro do app e usa notificacao do navegador quando a permissao estiver ativa.
            </p>
          </div>

          <Badge variant="secondary" className="gap-2 bg-background/60 text-muted-foreground">
            <BellRing className="h-3.5 w-3.5" />
            {formatPermissionLabel(permission)}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Sistema ativo</p>
              <p className="text-xs text-muted-foreground">Liga ou desliga todo o motor de notificacoes.</p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Notificacao do navegador</p>
                  <p className="text-xs text-muted-foreground">Melhor quando a aba estiver em segundo plano.</p>
                </div>
                <Switch
                  checked={draft.browser_enabled}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, browser_enabled: checked }))}
                />
              </div>
              <Button onClick={handlePermission} variant="outline" size="sm" className="mt-4">
                Solicitar permissao
              </Button>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Toast no app</p>
                  <p className="text-xs text-muted-foreground">Fallback quando voce estiver com a tela aberta.</p>
                </div>
                <Switch
                  checked={draft.toast_enabled}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, toast_enabled: checked }))}
                />
              </div>
              <Button onClick={sendTestNotification} variant="outline" size="sm" className="mt-4">
                Enviar teste
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                key: "meetings_enabled",
                label: "Reunioes",
                description: "Lembretes antes do inicio e aviso quando a reuniao comecar.",
              },
              {
                key: "meeting_follow_up_enabled",
                label: "Atas e follow-ups",
                description: "Avisa quando falta registrar ata ou concluir pendencias de reuniao.",
              },
              {
                key: "tasks_enabled",
                label: "Tarefas",
                description: "Prazo de hoje, atrasos e execucao parada.",
              },
              {
                key: "finance_enabled",
                label: "Financeiro",
                description: "Vencimentos proximos e itens vencidos.",
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={draft[item.key as keyof NotificationPreferences] as boolean}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      [item.key]: checked,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Lembretes de reuniao</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha os marcos que disparam antes da reuniao. O app evita duplicacao por navegador.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {NOTIFICATION_REMINDER_OPTIONS.map((minute) => {
                const active = draft.meeting_reminder_minutes.includes(minute);
                return (
                  <label
                    key={minute}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background/70 text-muted-foreground",
                    )}
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleReminderMinute(minute)}
                    />
                    {minute} min antes
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 p-4">
            <div className="flex items-center gap-2">
              <MoonStar className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Janela de silencio</p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[auto_120px_120px_auto] md:items-end">
              <div className="flex items-center gap-3">
                <Switch
                  checked={draft.quiet_hours_enabled}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, quiet_hours_enabled: checked }))}
                />
                <span className="text-sm text-foreground">Ativar horario silencioso</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Inicio</Label>
                <Input
                  type="time"
                  value={draft.quiet_hours_start}
                  onChange={(event) => setDraft((current) => ({ ...current, quiet_hours_start: event.target.value }))}
                  className="h-11 rounded-2xl border-border bg-background/60"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fim</Label>
                <Input
                  type="time"
                  value={draft.quiet_hours_end}
                  onChange={(event) => setDraft((current) => ({ ...current, quiet_hours_end: event.target.value }))}
                  className="h-11 rounded-2xl border-border bg-background/60"
                />
              </div>

              <div className="flex items-center gap-3 pb-2">
                <Switch
                  checked={draft.weekend_notifications}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, weekend_notifications: checked }))}
                />
                <span className="text-sm text-foreground">Notificar aos finais de semana</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 p-4">
            <Label className="text-xs text-muted-foreground">Maximo por rodada</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={String(draft.max_notifications_per_cycle)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  max_notifications_per_cycle: Math.max(1, Math.min(10, Number(event.target.value) || 1)),
                }))
              }
              className="mt-2 h-11 max-w-[160px] rounded-2xl border-border bg-background/60 font-mono"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Limita quantas notificacoes novas podem sair a cada ciclo de avaliacao.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={!ready || saving || !hasChanges} className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar notificacoes"}
            </Button>
            <Button onClick={handleReset} disabled={!ready || saving} variant="outline" className="h-11 rounded-2xl">
              Restaurar padrao
            </Button>
            <span className="text-xs text-muted-foreground">
              {hasChanges ? "Existem alteracoes nao salvas." : "Preferencias sincronizadas."}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/95 p-5">
        <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Status</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Saude do motor de notificacoes</h2>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-border/70 bg-background/35 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success-foreground" />
              <p className="text-sm font-medium text-foreground">Ultima avaliacao</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{formatDateLabel(lastEvaluatedAt)}</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 p-4">
            <p className="text-sm font-medium text-foreground">Ultima entrega</p>
            <p className="mt-2 text-sm text-muted-foreground">{formatDateLabel(lastDeliveredAt)}</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 p-4">
            <p className="text-sm font-medium text-foreground">Supressoes ativas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={suppressed.quietHours ? "default" : "secondary"}>
                {suppressed.quietHours ? "Horario silencioso ativo" : "Sem silencio por horario"}
              </Badge>
              <Badge variant={suppressed.weekend ? "default" : "secondary"}>
                {suppressed.weekend ? "Fim de semana suprimido" : "Finais de semana liberados"}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/35 p-4 text-sm text-muted-foreground">
            <p>
              Escopo atual: notificacoes do navegador e toast enquanto o app estiver aberto. Para push real com app fechado,
              ainda seria necessario adicionar um backend de push/service worker com entrega remota.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
