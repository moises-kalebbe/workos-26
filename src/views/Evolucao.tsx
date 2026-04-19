import Link from "next/link";
import { CalendarDays, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DailyReflectionEditor } from "@/components/evolucao/daily-reflection-editor";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { useEvolucaoFeature } from "@/features/evolucao/hooks";
import { useAuth } from "@/hooks/useAuth";
import { countCompletedDailyReflectionChecklistItems } from "@/lib/dailyReflection";

function formatHistoryDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function EvolucaoPage() {
  const { user } = useAuth();
  const {
    draft,
    history,
    loading,
    moodOptions,
    ratingOptions,
    saving,
    carryOverFocus,
    todayDateKey,
    todayPrompt,
    updateDraft,
    saveTodayEntry,
  } = useEvolucaoFeature({ userId: user?.id || null });

  if (loading && !todayPrompt && history.length === 0) {
    return <LoadingState message="Carregando diário de evolução..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Evolução"
        description="Um registro por dia para transformar ideia boa em ação consciente e acompanhar sua evolução mental e pessoal."
        actions={(
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link href="/">
              Voltar ao dashboard
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      />

      <DailyReflectionEditor
        draft={draft}
        loading={loading}
        moodOptions={moodOptions}
        onSave={saveTodayEntry}
        onUpdateDraft={updateDraft}
        prompt={todayPrompt}
        ratingOptions={ratingOptions}
        saving={saving}
        carryOverFocus={carryOverFocus}
        title="Registro do dia"
        description={`Prompt ativo para ${formatHistoryDate(todayDateKey)}.`}
      />

      <section className="rounded-2xl border border-border bg-card/95 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Histórico</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Entradas anteriores</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Veja a sequência dos prompts, seu estado emocional e as ações que você registrou.
            </p>
          </div>
          <Badge variant="secondary">{history.length} registros</Badge>
        </div>

        {history.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nenhum registro ainda"
              description="Salve o prompt de hoje para iniciar seu histórico de evolução."
              icon={Sparkles}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {history.map((entry) => {
              const mood = moodOptions.find((option) => option.value === entry.mood);
              const completedChecklistCount = countCompletedDailyReflectionChecklistItems(entry.checklist_json);
              return (
                <article key={entry.id} className="rounded-2xl border border-border bg-background/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          {entry.prompt ? `Prompt #${entry.prompt.position}` : "Prompt"}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatHistoryDate(entry.entry_date)}
                        </Badge>
                        <Badge variant="secondary">Nota {entry.self_rating}/5</Badge>
                        {entry.checklist_json.length > 0 ? (
                          <Badge variant="secondary">
                            {completedChecklistCount}/{entry.checklist_json.length} checks
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-foreground">
                        {entry.prompt?.title || "Prompt indisponivel"}
                      </h3>
                      {entry.prompt?.summary ? (
                        <p className="mt-1 text-sm text-muted-foreground">{entry.prompt.summary}</p>
                      ) : null}
                    </div>

                    <div className="self-start rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-left sm:self-auto sm:text-right">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Humor</p>
                      <p className={mood?.tone || "text-foreground"}>{mood?.label || entry.mood}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/70 bg-card/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Ações tomadas</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.actions_taken_md}</p>
                  </div>

                  {entry.checklist_json.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Aplicacao pratica</p>
                      <div className="mt-2 space-y-2">
                        {entry.checklist_json.map((checklistItem) => (
                          <label key={checklistItem.id} className="flex items-start gap-3 text-sm text-foreground">
                            <Checkbox checked={checklistItem.completed} disabled className="mt-0.5" />
                            <span className={checklistItem.completed ? "line-through text-muted-foreground" : ""}>
                              {checklistItem.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {entry.tomorrow_focus ? (
                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Proxima acao</p>
                      <p className="mt-2 text-sm text-foreground">{entry.tomorrow_focus}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
