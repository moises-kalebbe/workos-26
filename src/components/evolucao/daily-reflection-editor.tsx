import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { countCompletedDailyReflectionChecklistItems } from "@/lib/dailyReflection";
import { cn } from "@/lib/utils";
import type { EvolucaoDraft, EvolucaoMood, EvolucaoPrompt } from "@/features/evolucao/types";

type MoodOption = {
  value: EvolucaoMood;
  label: string;
  tone: string;
};

export function DailyReflectionEditor({
  draft,
  loading,
  moodOptions,
  onSave,
  onUpdateDraft,
  prompt,
  ratingOptions,
  saving,
  footer,
  carryOverFocus,
  title = "Evolução de hoje",
  description = "Um prompt por dia para registrar ações concretas e acompanhar seu estado.",
}: {
  draft: EvolucaoDraft;
  loading: boolean;
  moodOptions: MoodOption[];
  onSave: () => void;
  onUpdateDraft: (patch: Partial<EvolucaoDraft>) => void;
  prompt: EvolucaoPrompt | null;
  ratingOptions: number[];
  saving: boolean;
  footer?: React.ReactNode;
  carryOverFocus?: string;
  title?: string;
  description?: string;
}) {
  const promptScore = prompt ? Number(prompt.score) : Number.NaN;
  const hasValidPromptScore = Number.isFinite(promptScore);
  const completedChecklistCount = countCompletedDailyReflectionChecklistItems(draft.checklist);

  return (
    <section className="rounded-2xl border border-border bg-card/95 p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">Diário guiado</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        {prompt ? (
          <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
            Nota base {hasValidPromptScore ? promptScore.toFixed(1) : "indisponivel"}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !prompt ? (
        <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
          Nenhum prompt de evolução foi encontrado no banco.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-primary">
                Prompt #{prompt.position}
              </Badge>
              <Badge variant="secondary" className="bg-background/70 text-muted-foreground">
                Rotacao diária
              </Badge>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-foreground">{prompt.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{prompt.summary}</p>

            <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
              <p className="text-eyebrow font-semibold uppercase tracking-label text-primary">Como aplicar</p>
              <p className="mt-1 text-sm text-foreground">{prompt.application_hint}</p>
            </div>
          </div>

          {carryOverFocus ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-eyebrow font-semibold uppercase tracking-label text-primary">Carry-over de ontem</p>
              <p className="mt-2 text-sm text-foreground">{carryOverFocus}</p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-eyebrow font-semibold uppercase tracking-label text-primary">Aplicacao pratica</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Marque o que voce realmente aplicou hoje. A ideia aqui e execucao, nao so leitura.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                {completedChecklistCount}/{draft.checklist.length} checks
              </Badge>
            </div>

            <div className="mt-4 space-y-2">
              {draft.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-3 text-sm text-foreground transition-colors hover:border-primary/30"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) =>
                      onUpdateDraft({
                        checklist: draft.checklist.map((currentItem) =>
                          currentItem.id === item.id
                            ? { ...currentItem, completed: checked === true }
                            : currentItem,
                        ),
                      })
                    }
                    className="mt-0.5"
                  />
                  <span className={cn("whitespace-pre-wrap break-words", item.completed && "line-through text-muted-foreground")}>
                    {item.title}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ações tomadas hoje</Label>
            <Textarea
              value={draft.actionsTakenMd}
              onChange={(event) => onUpdateDraft({ actionsTakenMd: event.target.value })}
              placeholder="Escreva o que você aplicou, o que funcionou e o que precisa ajustar amanha."
              className="min-h-[160px] rounded-2xl border-border bg-background/60"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Proxima acao de amanha</Label>
            <Input
              value={draft.tomorrowFocus}
              onChange={(event) => onUpdateDraft({ tomorrowFocus: event.target.value })}
              placeholder="Ex.: abrir o dia fechando a proposta principal."
              className="rounded-2xl border-border bg-background/60"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nota do dia</Label>
              <Select value={draft.selfRating} onValueChange={(value) => onUpdateDraft({ selfRating: value })}>
                <SelectTrigger className="rounded-2xl border-border bg-background/60">
                  <SelectValue placeholder="Escolha uma nota de 1 a 5" />
                </SelectTrigger>
                <SelectContent>
                  {ratingOptions.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} / 5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Como você terminou o dia</Label>
              <Select value={draft.mood} onValueChange={(value) => onUpdateDraft({ mood: value as EvolucaoMood })}>
                <SelectTrigger className="rounded-2xl border-border bg-background/60">
                  <SelectValue placeholder="Escolha seu estado" />
                </SelectTrigger>
                <SelectContent>
                  {moodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.mood ? (
                <p className={cn("text-xs font-medium", moodOptions.find((option) => option.value === draft.mood)?.tone)}>
                  {moodOptions.find((option) => option.value === draft.mood)?.label}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              O registro de hoje pode ser editado ao longo do dia e fica salvo no histórico.
            </div>

            <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              {footer}
              <Button onClick={onSave} disabled={saving} className="w-full gap-2 sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar registro
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
