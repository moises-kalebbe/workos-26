import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  Landmark,
  Loader2,
  Timer,
} from "lucide-react";
import { DailyReflectionEditor } from "@/components/evolucao/daily-reflection-editor";
import { LeiDoDia } from "@/components/system/lei-do-dia";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardFeature } from "@/features/dashboard/hooks";
import type {
  DashboardActionDescriptor,
  DashboardAttentionItem,
  DashboardAttentionTone,
  DashboardProjectHealth,
} from "@/features/dashboard/types";
import { useEvolucaoFeature } from "@/features/evolucao/hooks";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

function getAttentionToneClass(tone: DashboardAttentionTone) {
  switch (tone) {
    case "danger":
      return "border-danger/30 bg-danger/10 text-danger";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning";
    case "info":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-border bg-background/70 text-muted-foreground";
  }
}

function getHealthLevelClass(level: DashboardProjectHealth["level"]) {
  switch (level) {
    case "at_risk":
      return "border-danger/30 bg-danger/10 text-danger";
    case "attention":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-success/30 bg-success-muted text-success-foreground";
  }
}

function getHealthLevelLabel(level: DashboardProjectHealth["level"]) {
  switch (level) {
    case "at_risk":
      return "Em risco";
    case "attention":
      return "Atenção";
    default:
      return "Estável";
  }
}

function formatTargetLabel(trackedSecondsToday: number, targetSecondsToday: number) {
  if (targetSecondsToday <= 0) {
    return `${formatDuration(trackedSecondsToday)} hoje`;
  }

  return `${formatDuration(trackedSecondsToday)} / ${formatDuration(targetSecondsToday)}`;
}

function DashboardActionButton({
  action,
  onAction,
  pending,
  variant = "default",
  className,
}: {
  action: DashboardActionDescriptor;
  onAction: (action: DashboardActionDescriptor) => Promise<void> | void;
  pending: boolean;
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  if (action.href) {
    if (action.external) {
      return (
        <Button asChild size="sm" variant={variant} className={cn("gap-2", className)}>
          <a href={action.href} target="_blank" rel="noopener noreferrer">
            {action.label}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      );
    }

    return (
      <Button asChild size="sm" variant={variant} className={cn("gap-2", className)}>
        <Link href={action.href}>
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant={variant}
      className={cn("gap-2", className)}
      disabled={pending}
      onClick={() => {
        void onAction(action);
      }}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {action.label}
    </Button>
  );
}

function AttentionItemCard({
  item,
  actionPending,
  onAction,
}: {
  item: DashboardAttentionItem;
  actionPending: (action: DashboardActionDescriptor) => boolean;
  onAction: (action: DashboardActionDescriptor) => Promise<void>;
}) {
  const hasSecondaryAction = Boolean(item.secondaryAction);

  return (
    <article
      data-testid={`dashboard-attention-${item.type}`}
      className="rounded-2xl border border-border bg-background/25 p-3 transition-colors hover:border-primary/30"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border", getAttentionToneClass(item.tone))}>{item.badgeLabel}</Badge>
            <Badge variant="outline">#{item.rank}</Badge>
            {item.projectName ? <Badge variant="secondary">{item.projectName}</Badge> : null}
          </div>
          <p className="mt-3 text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">{item.eyebrow}</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>

        <div className={cn("grid w-full gap-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end", hasSecondaryAction ? "grid-cols-2" : "grid-cols-1")}>
          <DashboardActionButton
            action={item.primaryAction}
            onAction={onAction}
            pending={actionPending(item.primaryAction)}
            className="w-full justify-between sm:w-auto sm:justify-center"
          />
          {item.secondaryAction ? (
            <DashboardActionButton
              action={item.secondaryAction}
              onAction={onAction}
              pending={actionPending(item.secondaryAction)}
              variant="outline"
              className="w-full justify-between sm:w-auto sm:justify-center"
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function IndexPage() {
  const { user } = useAuth();
  const dashboard = useDashboardFeature();
  const dailyReflection = useEvolucaoFeature({ userId: user?.id || null });

  const healthSummary = dashboard.projectHealth.reduce(
    (acc, item) => {
      acc[item.level] += 1;
      return acc;
    },
    { at_risk: 0, attention: 0, stable: 0 } as Record<DashboardProjectHealth["level"], number>,
  );

  const actionPending = (action: DashboardActionDescriptor) => dashboard.actingKey === dashboard.getActionKey(action);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Painel principal"
        description="Cockpit diário para decidir o próximo passo e executar microações sem trocar de tela."
      />

      <section
        data-testid="dashboard-now"
        className="overflow-hidden rounded-3xl border border-primary/20 bg-hero p-4 shadow-glow md:p-6"
      >
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-loose text-brand-text/80">Agora</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground md:text-2xl">{dashboard.primaryRecommendation.title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{dashboard.primaryRecommendation.reason}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <DashboardActionButton
                action={dashboard.primaryRecommendation.primaryAction}
                onAction={dashboard.handleAction}
                pending={actionPending(dashboard.primaryRecommendation.primaryAction)}
              />
              {dashboard.primaryRecommendation.secondaryAction ? (
                <DashboardActionButton
                  action={dashboard.primaryRecommendation.secondaryAction}
                  onAction={dashboard.handleAction}
                  pending={actionPending(dashboard.primaryRecommendation.secondaryAction)}
                  variant="outline"
                />
              ) : null}
            </div>

            {dashboard.primaryRecommendation.context.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {dashboard.primaryRecommendation.context.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4 text-primary" />
                <p className="text-eyebrow font-semibold uppercase tracking-label">Tempo do dia</p>
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">{formatDuration(dashboard.trackedTodaySeconds)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dashboard.totalTargetSeconds > 0
                  ? `${Math.round((dashboard.trackedTodaySeconds / dashboard.totalTargetSeconds) * 100)}% da meta diária agregada.`
                  : "Sem meta diária agregada definida nos projetos."}
              </p>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <p className="text-eyebrow font-semibold uppercase tracking-label">Fila de atenção</p>
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">{dashboard.attentionQueue.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dashboard.attentionQueue.length > 0
                  ? `${dashboard.attentionQueue.filter((item) => item.tone === "danger").length} item(ns) crítico(s) agora.`
                  : "Nenhuma pendência crítica detectada neste momento."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Performance</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Modulo Treino</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Abra a periodizacao de 24 semanas, registre cargas por exercicio e acompanhe a dica mental diaria.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/treino">
              Abrir treino
              <Dumbbell className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div
          data-testid="dashboard-attention-queue"
          className="rounded-2xl border border-border bg-card p-4 md:p-6"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Fila de atenção</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Tudo o que pede decisão hoje</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ordem fixa por risco operacional, com atalhos para agir sem trocar de página.
              </p>
            </div>
            <Badge variant="secondary">{dashboard.attentionQueue.length}</Badge>
          </div>

          {dashboard.loading ? (
            <div className="flex h-28 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : dashboard.attentionQueue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              Nenhum item entrou na fila de atenção. Use o Kanban recomendado ou a agenda de hoje para avançar.
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.attentionQueue.map((item) => (
                <AttentionItemCard
                  key={item.id}
                  item={item}
                  actionPending={actionPending}
                  onAction={dashboard.handleAction}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Saúde por projeto</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Meta do dia, tarefas críticas, financeiro acionável e próximas reuniões em 48h.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 xl:grid-cols-1">
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-eyebrow uppercase tracking-wide text-muted-foreground">Em risco</p>
                <p className="mt-2 text-2xl font-semibold text-danger">{healthSummary.at_risk}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-eyebrow uppercase tracking-wide text-muted-foreground">Atenção</p>
                <p className="mt-2 text-2xl font-semibold text-warning">{healthSummary.attention}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-4">
                <p className="text-eyebrow uppercase tracking-wide text-muted-foreground">Estáveis</p>
                <p className="mt-2 text-2xl font-semibold text-success-foreground">{healthSummary.stable}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Agenda hoje</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Reuniões do dia com entrada rápida no Meet e atalhos para atas.
            </p>

            <div className="mt-4">
              {dashboard.meetingsLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !dashboard.meetingsConnected ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Google Calendar não conectado. Conecte na Agenda para trazer reuniões para o cockpit.
                </div>
              ) : dashboard.todayMeetings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Nenhuma reunião prevista para hoje.
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.todayMeetings.slice(0, 4).map((meeting) => {
                    const start = new Date(meeting.start);
                    const end = new Date(meeting.end);
                    const action = meeting.meetLink
                      ? {
                          kind: "join_meeting" as const,
                          label: "Entrar no Meet",
                          href: meeting.meetLink,
                          external: true,
                          eventId: meeting.id,
                        }
                      : {
                          kind: "open_agenda" as const,
                          label: "Abrir agenda",
                          href: "/agenda?preset=today",
                        };

                    return (
                      <div key={meeting.id} className="rounded-xl border border-border bg-background/25 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {meeting.allDay
                                  ? "Dia inteiro"
                                  : `${start.toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })} - ${end.toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}`}
                              </Badge>
                              {meeting.projectName ? <Badge variant="secondary">{meeting.projectName}</Badge> : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">{meeting.summary}</p>
                          </div>

                          <div className={cn("grid w-full gap-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end", meeting.meetLink ? "grid-cols-2" : "grid-cols-1")}>
                            <DashboardActionButton
                              action={action}
                              onAction={dashboard.handleAction}
                              pending={actionPending(action)}
                              className="w-full justify-between sm:w-auto sm:justify-center"
                            />
                            <Button asChild size="sm" variant="outline" className="w-full justify-between sm:w-auto sm:justify-center">
                              <Link href={`/atas?meeting=${encodeURIComponent(meeting.id)}`}>Ver atas</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <LeiDoDia now={dashboard.now} />

      <DailyReflectionEditor
        draft={dailyReflection.draft}
        loading={dailyReflection.loading}
        moodOptions={dailyReflection.moodOptions}
        onSave={dailyReflection.saveTodayEntry}
        onUpdateDraft={dailyReflection.updateDraft}
        prompt={dailyReflection.todayPrompt}
        ratingOptions={dailyReflection.ratingOptions}
        saving={dailyReflection.saving}
        carryOverFocus={dailyReflection.carryOverFocus}
        footer={(
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/evolucao">Abrir histórico</Link>
          </Button>
        )}
      />

      <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Financeiro</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Resumo financeiro do cockpit</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entradas, saídas e vencimentos visíveis sem sair do painel principal.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/financeiro?tab=executivo&status=actionable">
              Abrir financeiro
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowUpCircle className="h-4 w-4 text-success-foreground" />
              <p className="text-eyebrow uppercase tracking-wide">A receber</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(dashboard.financialMetrics.receivableOpen)}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowDownCircle className="h-4 w-4 text-warning-foreground" />
              <p className="text-eyebrow uppercase tracking-wide">A pagar</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatMoney(dashboard.financialMetrics.payableOpen)}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-danger-foreground" />
              <p className="text-eyebrow uppercase tracking-wide">Vencidos</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{dashboard.financialMetrics.overdueCount}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Landmark className="h-4 w-4 text-primary" />
              <p className="text-eyebrow uppercase tracking-wide">Próximos</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{dashboard.financialMetrics.upcomingCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Timeline</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Linha do tempo de hoje</h2>
            <p className="text-sm text-muted-foreground">Sessões registradas no timezone {dashboard.timezone}.</p>
          </div>
          <Badge variant="secondary">{dashboard.timelineBlocks.length} sessões</Badge>
        </div>

        {dashboard.loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : dashboard.timelineBlocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Sem sessões registradas hoje ainda.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative ml-52 hidden h-4 text-caption text-muted-foreground md:block">
              {dashboard.timelineHourLabels.map((hour) => (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}h
                </span>
              ))}
            </div>

            {dashboard.timelineBlocks.map((block) => (
              <div key={block.id} className="grid gap-2 md:grid-cols-[200px_1fr] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{block.label}</p>
                  <p className="truncate text-eyebrow text-muted-foreground">
                    {block.company || "Sem empresa"} · {formatDuration(block.durationSeconds)} · {formatMoney(block.estimatedValue)}
                  </p>
                </div>

                <div className="relative h-8 overflow-hidden rounded-md border border-border bg-background/40">
                  {dashboard.timelineHourLabels.map((hour) => (
                    <span
                      key={hour}
                      className="absolute inset-y-0 w-px bg-border/70"
                      style={{ left: `${(hour / 24) * 100}%` }}
                    />
                  ))}

                  <span
                    className="absolute inset-y-0 w-px bg-primary/60"
                    style={{ left: `${(dashboard.currentMinuteMarker / 1440) * 100}%` }}
                  />

                  <span
                    className={cn("absolute inset-y-1 rounded-sm", block.isActive && "animate-pulse")}
                    style={{
                      left: `${block.leftPercent}%`,
                      width: `${block.widthPercent}%`,
                      backgroundColor: block.color || "hsl(var(--primary))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-testid="dashboard-project-health" className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Saúde por projeto</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Mapa operacional dos clientes e frentes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão ordenada por risco, com metas do dia, vencimentos e compromissos próximos.
            </p>
          </div>
          <Badge variant="secondary">{dashboard.projectHealth.length}</Badge>
        </div>

        {dashboard.loading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : dashboard.projectHealth.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Nenhum projeto cadastrado ainda. Crie em Configurações para ativar o radar operacional.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboard.projectHealth.map((project) => {
              const progress = project.targetSecondsToday > 0
                ? Math.min(100, Math.round((project.trackedSecondsToday / project.targetSecondsToday) * 100))
                : 0;

              return (
                <article key={project.projectId} className="rounded-2xl border border-border bg-background/25 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: project.color || "hsl(var(--primary))" }}
                        />
                        <h3 className="truncate text-base font-semibold text-foreground">{project.projectName}</h3>
                        <Badge className={cn("border", getHealthLevelClass(project.level))}>
                          {getHealthLevelLabel(project.level)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{project.client || "Sem cliente definido"}</p>
                      <p className="mt-2 text-sm text-foreground">{project.reason}</p>
                    </div>

                    <Button asChild size="sm" variant="outline" className="w-full justify-between sm:w-auto sm:justify-center">
                      <Link href={`/tracker?project=${project.projectId}`}>Abrir no tracker</Link>
                    </Button>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-3 text-eyebrow uppercase tracking-wide text-muted-foreground">
                      <span>Meta do dia</span>
                      <span>{formatTargetLabel(project.trackedSecondsToday, project.targetSecondsToday)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          project.level === "at_risk" ? "bg-danger" : project.level === "attention" ? "bg-warning" : "bg-success",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {project.overdueTaskCount > 0 ? (
                      <span className="rounded-full bg-danger/10 px-2.5 py-1 text-danger">
                        {project.overdueTaskCount} tarefa(s) atrasada(s)
                      </span>
                    ) : null}
                    {project.dueTodayTaskCount > 0 ? (
                      <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">
                        {project.dueTodayTaskCount} prazo(s) hoje
                      </span>
                    ) : null}
                    {project.actionableFinanceCount > 0 ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                        {project.actionableFinanceCount} item(ns) financeiro(s)
                      </span>
                    ) : null}
                    {project.meetingCount48h > 0 ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                        Próxima reunião: {project.nextMeetingLabel}
                      </span>
                    ) : null}
                    {project.overdueTaskCount === 0 &&
                    project.dueTodayTaskCount === 0 &&
                    project.actionableFinanceCount === 0 &&
                    project.meetingCount48h === 0 ? (
                      <span className="rounded-full bg-success-muted px-2.5 py-1 text-success-foreground">
                        Sem alertas imediatos
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-border/70 pt-4">
        <p className="text-center text-xs text-muted-foreground">
          Cockpit diário com fila de atenção, quick actions e saúde operacional por projeto.
        </p>
      </footer>
    </div>
  );
}
