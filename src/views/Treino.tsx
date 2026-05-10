"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Info,
  Pencil,
  Repeat,
  RotateCcw,
  Scale,
  Search,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { EmptyState } from "@/components/system/empty-state";
import { ErrorState } from "@/components/system/error-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { TreinoOnboardingInput, TreinoSessionDraft, TreinoSetDraft } from "@/features/treino/types";
import { createEmptyTreinoSetDraft, createTrainingSessionDraft, useTreinoFeature } from "@/features/treino/hooks";
import { useAuth } from "@/hooks/useAuth";
import { getExerciseInfo } from "@/lib/exerciseLibrary";
import { recommendLoadProgression } from "@/lib/trainingPlan";
import { cn } from "@/lib/utils";

const DAY_SEQUENCE = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terca" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
] as const;

const EXERCISE_CATEGORY_LABELS: Record<string, string> = {
  mobility: "Mobilidade",
  push: "Empurrar",
  pull: "Puxar",
  integrated: "Integrado",
  core_stability: "Core (estabilidade)",
  core_strength: "Core (forca)",
  power_plyometrics: "Potencia/Pliometria",
  brachiation: "Braquiacao",
  general_strengthening: "Fortalecimento geral",
};

function SmallStat({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="rounded-2xl border-border bg-card/95">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-xs uppercase tracking-label">{label}</p>
        </div>
        <p className="mt-2 truncate text-xl font-semibold text-foreground md:text-2xl">{value}</p>
        <p className="mt-1 break-words text-xs text-muted-foreground md:text-sm">{helper}</p>
      </CardContent>
    </Card>
  );
}

function defaultOnboarding(): TreinoOnboardingInput {
  return {
    age: "37",
    weightKg: "104",
    heightCm: "",
    trainingBackground: "Treinei por anos, parei e estou retornando agora com foco em performance no beach tennis.",
  };
}

function formatSessionBadge(type: string) {
  if (type === "beach_tennis") return "Beach tennis";
  if (type === "strength") return "Forca";
  if (type === "power") return "Potencia";
  if (type === "recovery") return "Recuperacao";
  return "Full body";
}

function formatTimeSlot(value: string) {
  return value === "morning" ? "07:00-08:20" : "Noite";
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function formatLongDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatExerciseTarget(min: number | null, max: number | null, loadMode: string) {
  if (loadMode === "time" && min && max && min === max) return `${min}s`;
  if (loadMode === "distance" && min && max && min === max) return `${min}m`;
  if (min && max && min === max) return `${min}`;
  if (min && max) return `${min}-${max}`;
  if (min) return `${min}+`;
  return "Livre";
}

function pickProgressionLabel(action: string) {
  if (action === "increase") return "Subir carga";
  if (action === "reduce_volume") return "Reduzir volume";
  return "Manter";
}

function createMeasurementDraft({
  measurement,
  fallbackWeightKg,
  measurementDate,
}: {
  measurement?: {
    id?: string;
    weight_kg?: number | null;
    waist_cm?: number | null;
    notes_md?: string | null;
  } | null;
  fallbackWeightKg?: number | null;
  measurementDate: string;
}) {
  return {
    measurementId: measurement?.id || null,
    measurementDate,
    weightKg: measurement?.weight_kg ? String(measurement.weight_kg) : fallbackWeightKg ? String(fallbackWeightKg) : "",
    waistCm: measurement?.waist_cm ? String(measurement.waist_cm) : "",
    notesMd: measurement?.notes_md || "",
  };
}

export default function TreinoPage() {
  const { user } = useAuth();
  const {
    activeProgram,
    blocks,
    bootstrapping,
    bootstrapProgram,
    chartPoints,
    currentWeekNumber,
    currentWeekSessions,
    error,
    loading,
    mentalEntries,
    mentalPrompts,
    measurements,
    profile,
    deleteMeasurement,
    deleteSessionLog,
    saveMeasurement,
    saveSessionLog,
    savingMeasurement,
    savingSession,
    sessionsWithContext,
    todayKey,
    todayMentalEntry,
    todayMentalPrompt,
    todaySession,
    toggleMentalApplied,
    exerciseCatalog,
    swapSessionExercise,
    swappingExerciseId,
  } = useTreinoFeature({ userId: user?.id || null });

  const [activeTab, setActiveTab] = useState("hoje");
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<TreinoOnboardingInput>(defaultOnboarding);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [draft, setDraft] = useState<TreinoSessionDraft>(createTrainingSessionDraft(null));
  const [measurementDraft, setMeasurementDraft] = useState({
    measurementId: null as string | null,
    measurementDate: "",
    weightKg: "",
    waistCm: "",
    notesMd: "",
  });
  const [sessionDeleteOpen, setSessionDeleteOpen] = useState(false);
  const [measurementPendingDelete, setMeasurementPendingDelete] = useState<(typeof measurements)[number] | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<string>("all");
  const [swapTarget, setSwapTarget] = useState<{ id: string; name: string; category: string } | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const sessionTabRef = useRef<HTMLDivElement | null>(null);
  const previousTodaySessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!todaySession) return;

    const shouldFollowToday =
      !selectedSessionId
      || selectedSessionId === previousTodaySessionIdRef.current;

    previousTodaySessionIdRef.current = todaySession.id;

    if (shouldFollowToday) {
      setSelectedSessionId(todaySession.id);
    }
  }, [selectedSessionId, todaySession]);

  const selectedSession = useMemo(
    () => sessionsWithContext.find((session) => session.id === selectedSessionId) || todaySession || null,
    [selectedSessionId, sessionsWithContext, todaySession],
  );

  useEffect(() => {
    setDraft(createTrainingSessionDraft(selectedSession));
  }, [selectedSession]);

  useEffect(() => {
    if (activeTab !== "sessao") return;
    if (typeof window === "undefined" || window.innerWidth >= 768) return;

    const frameId = window.requestAnimationFrame(() => {
      sessionTabRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeTab, selectedSessionId]);

  useEffect(() => {
    const latestMeasurement = measurements[0];
    setMeasurementDraft((current) => {
      if (current.measurementId) return current;
      return createMeasurementDraft({
        measurement: latestMeasurement,
        fallbackWeightKg: profile?.weight_kg,
        measurementDate: todayKey,
      });
    });
  }, [measurements, profile?.weight_kg, todayKey]);

  const currentBlock = blocks.find((block) => currentWeekNumber >= block.week_start && currentWeekNumber <= block.week_end) || null;
  const latestMeasurement = measurements[0] || null;
  const currentWeekLoad = currentWeekSessions.reduce((total, session) => total + (session.log?.session_load || 0), 0);
  const completedSessionsWeek = currentWeekSessions.filter((session) => session.log).length;
  const nextDeloadWeek = [4, 8, 12, 16, 20, 24].find((week) => week >= currentWeekNumber) || 24;
  const appliedMentalEntries = mentalEntries.filter((entry) => entry.applied).length;
  const mentalAdherence = mentalEntries.length > 0 ? Math.round((appliedMentalEntries / mentalEntries.length) * 100) : 0;

  const sessionsByDay = useMemo(() => {
    return DAY_SEQUENCE.map((day) => ({
      ...day,
      morning: currentWeekSessions.find((session) => session.day_of_week === day.key && session.time_slot === "morning") || null,
      night: currentWeekSessions.find((session) => session.day_of_week === day.key && session.time_slot === "night") || null,
    }));
  }, [currentWeekSessions]);

  const progressionHints = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.exercises
      .filter((exercise) => exercise.category === "main")
      .map((exercise) => {
        const sets = selectedSession.exerciseLogs.filter((row) => row.training_session_exercise_id === exercise.id);
        if (!sets.length || !exercise.target_rep_min || !exercise.target_rep_max || !exercise.target_rpe) return null;

        return {
          exerciseId: exercise.id,
          exerciseName: exercise.exercise_name,
          recommendation: recommendLoadProgression({
            target_rep_min: exercise.target_rep_min,
            target_rep_max: exercise.target_rep_max,
            target_rpe: exercise.target_rpe,
            reps_completed: sets.map((row) => row.reps_completed || 0),
            set_rpe: sets.map((row) => row.rpe || exercise.target_rpe || 8),
            load_increment_lower_kg: 5,
            load_increment_upper_kg: 2,
            emphasis: /squat|deadlift|trap|hip thrust|split squat|step-up/i.test(exercise.exercise_name) ? "lower" : "upper",
            readiness_score: draft.readinessScore ? Number.parseInt(draft.readinessScore, 10) : selectedSession.log?.readiness_score || null,
            sleep_hours: draft.sleepHours ? Number.parseFloat(draft.sleepHours) : selectedSession.log?.sleep_hours || null,
            previous_beach_tennis_rpe: 7,
          }),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);
  }, [draft.readinessScore, draft.sleepHours, selectedSession]);

  const mentalPromptById = useMemo(
    () => new Map(mentalPrompts.map((prompt) => [prompt.id, prompt])),
    [mentalPrompts],
  );

  const chartConfig = {
    sessionLoad: {
      label: "Carga semanal",
      color: "hsl(var(--primary))",
    },
    e1rm: {
      label: "e1RM estimado",
      color: "#22c55e",
    },
  };

  function updateDraftField(field: keyof Omit<TreinoSessionDraft, "exerciseSets">, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateExerciseSet(exerciseId: string, setIndex: number, patch: Partial<TreinoSetDraft>) {
    setDraft((current) => ({
      ...current,
      exerciseSets: {
        ...current.exerciseSets,
        [exerciseId]: (current.exerciseSets[exerciseId] || []).map((row, index) =>
          index === setIndex ? { ...row, ...patch } : row,
        ),
      },
    }));
  }

  function revertSessionDraft() {
    setDraft(createTrainingSessionDraft(selectedSession));
  }

  function clearExerciseSet(exerciseId: string, setIndex: number) {
    setDraft((current) => ({
      ...current,
      exerciseSets: {
        ...current.exerciseSets,
        [exerciseId]: (current.exerciseSets[exerciseId] || []).map((row, index) =>
          index === setIndex ? createEmptyTreinoSetDraft(row.setNumber) : row,
        ),
      },
    }));
  }

  function resetMeasurementEditor() {
    setMeasurementDraft(createMeasurementDraft({
      measurement: measurements[0] || null,
      fallbackWeightKg: profile?.weight_kg,
      measurementDate: todayKey,
    }));
  }

  function openMeasurementEditor(measurement: (typeof measurements)[number]) {
    setMeasurementDraft(createMeasurementDraft({
      measurement,
      fallbackWeightKg: profile?.weight_kg,
      measurementDate: measurement.measurement_date,
    }));
  }

  function openSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setActiveTab("sessao");
  }

  if (loading && !profile && sessionsWithContext.length === 0) {
    return <LoadingState message="Carregando modulo de treino..." />;
  }

  if (error && !profile && !activeProgram) {
    return <ErrorState message={error} />;
  }

  if (!profile || !activeProgram) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Treino"
          description="Crie seu programa profissional de 24 semanas para beach tennis com carga, evolucao e rotina mental."
          actions={(
            <Button asChild variant="outline" className="w-full justify-between gap-2 sm:w-auto sm:justify-center">
              <Link href="/">
                Voltar ao dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        />

        <Card className="rounded-2xl border-border bg-card/95">
          <CardHeader>
            <CardTitle>Onboarding do atleta</CardTitle>
            <CardDescription>
              Isso cria seu perfil, a periodizacao de 24 semanas, as sessoes fixas e a rotina mental diaria para beach tennis.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Idade</Label>
              <Input value={onboarding.age} onChange={(event) => setOnboarding((current) => ({ ...current, age: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Peso atual (kg)</Label>
              <Input value={onboarding.weightKg} onChange={(event) => setOnboarding((current) => ({ ...current, weightKg: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Altura (cm)</Label>
              <Input value={onboarding.heightCm} onChange={(event) => setOnboarding((current) => ({ ...current, heightCm: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Historico de treino</Label>
              <Textarea
                value={onboarding.trainingBackground}
                onChange={(event) => setOnboarding((current) => ({ ...current, trainingBackground: event.target.value }))}
                className="min-h-[140px]"
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              <p className="text-sm text-muted-foreground">
                Inicio do programa:{" "}
                <span className="font-medium text-foreground">
                  {(() => {
                    const now = new Date();
                    const daysUntilMonday = now.getDay() === 1 ? 0 : (8 - now.getDay()) % 7;
                    const monday = new Date(now);
                    monday.setDate(monday.getDate() + daysUntilMonday);
                    return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(monday);
                  })()}
                </span>
              </p>
              <Button onClick={() => void bootstrapProgram(onboarding)} disabled={bootstrapping} className="gap-2">
                <Dumbbell className="h-4 w-4" />
                {bootstrapping ? "Criando programa..." : "Criar meu modulo de treino"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Treino"
        description="Planejamento, execucao e analise do ciclo de 24 semanas para beach tennis."
        actions={(
          <>
            <Badge variant="secondary">Semana {currentWeekNumber}/24</Badge>
            {currentBlock ? <Badge variant="outline">{currentBlock.focus_label}</Badge> : null}
            <Button asChild variant="outline" className="w-full justify-between gap-2 sm:w-auto sm:justify-center">
              <Link href="/">
                Voltar ao dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SmallStat
          icon={Target}
          label="Bloco atual"
          value={currentBlock?.focus_label || "Plano ativo"}
          helper={currentBlock ? `Semanas ${currentBlock.week_start}-${currentBlock.week_end}` : "Periodizacao gerada automaticamente."}
        />
        <SmallStat
          icon={Activity}
          label="Carga da semana"
          value={String(Math.round(currentWeekLoad))}
          helper={`${completedSessionsWeek}/${currentWeekSessions.length} sessoes registradas.`}
        />
        <SmallStat
          icon={Scale}
          label="Peso atual"
          value={latestMeasurement?.weight_kg ? `${latestMeasurement.weight_kg.toFixed(1)} kg` : `${profile.weight_kg.toFixed(1)} kg`}
          helper={latestMeasurement?.waist_cm ? `Cintura ${latestMeasurement.waist_cm.toFixed(1)} cm.` : "Atualize o checkpoint na aba Evolucao."}
        />
        <SmallStat
          icon={BrainCircuit}
          label="Mental"
          value={`${mentalAdherence}%`}
          helper={`Aderencia mental. Proximo deload na semana ${nextDeloadWeek}.`}
        />
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-2xl bg-card/95 p-2 md:grid-cols-6">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="sessao">Sessao</TabsTrigger>
          <TabsTrigger value="evolucao">Evolucao</TabsTrigger>
          <TabsTrigger value="blocos">Blocos</TabsTrigger>
          <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <Card className="min-w-0 rounded-2xl border-border bg-card/95">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{todaySession ? formatDateLabel(todaySession.session_date) : "Sem sessao"}</Badge>
                  {todaySession ? <Badge variant="secondary">{formatSessionBadge(todaySession.session_type)}</Badge> : null}
                  {todaySession?.is_deload_week ? <Badge className="border-warning/30 bg-warning/10 text-warning">Deload</Badge> : null}
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-eyebrow font-semibold uppercase tracking-label text-primary">Sessao do dia</p>
                    <CardTitle className="text-xl leading-tight sm:text-2xl">{todaySession?.title || "Nenhuma sessao disponivel"}</CardTitle>
                  </div>
                  <CardDescription className="max-w-2xl text-sm leading-6">
                    {todaySession
                      ? `${todaySession.objective} Janela ${formatTimeSlot(todaySession.time_slot)}.`
                      : "O programa nao encontrou uma sessao para hoje."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {todaySession ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-border bg-background/40 p-3">
                        <p className="text-caption uppercase tracking-label text-muted-foreground">Duração alvo</p>
                        <p className="mt-1.5 text-base font-semibold text-foreground">{todaySession.target_duration_minutes} min</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/40 p-3">
                        <p className="text-caption uppercase tracking-label text-muted-foreground">RPE alvo</p>
                        <p className="mt-1.5 text-base font-semibold text-foreground">{todaySession.target_rpe || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/40 p-3">
                        <p className="text-caption uppercase tracking-label text-muted-foreground">Status</p>
                        <p className="mt-1.5 text-base font-semibold text-foreground">{todaySession.log ? "Registrada" : "Pendente"}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/30 p-4 sm:p-5">
                      <p className="text-eyebrow font-semibold uppercase tracking-label text-primary">Regras do dia</p>
                      <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                        <li>Readiness 2 ou menos: corte 1 serie do principal e retire o finisher.</li>
                        <li>Sono abaixo de 6h: priorize tecnica e reduza a densidade do treino.</li>
                        <li>Beach tennis noturno conta na mesma carga semanal.</li>
                      </ul>
                    </div>

                    <Button
                      className="h-12 w-full justify-between gap-2 rounded-xl px-4 text-base"
                      onClick={() => {
                        openSession(todaySession.id);
                      }}
                    >
                      Abrir sessao do dia
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="Sem sessao hoje"
                    description="Quando o programa estiver completo, a sessao do dia aparece aqui com foco, carga e bloco."
                  />
                )}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-3 lg:space-y-4">
              <Card className="rounded-2xl border-border bg-card/95">
                <CardHeader>
                  <CardTitle>Dica mental do dia</CardTitle>
                  <CardDescription>Rotacao diaria para melhorar foco, reset e comunicacao no beach tennis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {todayMentalPrompt ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{todayMentalPrompt.category}</Badge>
                          <Badge variant="outline">{todayMentalPrompt.evidence_tag}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{todayMentalPrompt.title}</h3>
                        <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                          {todayMentalPrompt.cue}
                        </p>
                        <p className="text-sm text-muted-foreground">{todayMentalPrompt.application_hint}</p>
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-border bg-background/30 p-3 text-sm text-foreground">
                        <Checkbox
                          checked={todayMentalEntry?.applied || false}
                          onCheckedChange={(checked) => {
                            void toggleMentalApplied(checked === true);
                          }}
                          className="mt-0.5"
                        />
                        <span>Marcar que aplicou a dica mental de hoje na quadra ou no treino.</span>
                      </label>
                    </>
                  ) : (
                    <EmptyState
                      icon={BrainCircuit}
                      title="Sem prompt mental"
                      description="Os prompts mentais aparecem aqui depois do onboarding."
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border bg-card/95">
                <CardHeader>
                  <CardTitle>Foco do bloco</CardTitle>
                  <CardDescription>Resumo operacional do bloco em andamento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentBlock ? (
                    <>
                      <div className="rounded-xl border border-border bg-background/30 p-3">
                        <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Volume</p>
                        <p className="mt-2 text-sm text-foreground">{currentBlock.volume_guidance}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/30 p-3">
                        <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Intensidade</p>
                        <p className="mt-2 text-sm text-foreground">{currentBlock.intensity_guidance}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/30 p-3">
                        <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Meta nutricional base</p>
                        <p className="mt-2 text-sm text-foreground">
                          Proteina alvo inicial {profile.protein_target_g_per_kg.toFixed(1)} g/kg/dia com perda lenta, sem deficit agressivo.
                        </p>
                      </div>
                    </>
                  ) : (
                    <EmptyState icon={Target} title="Bloco indisponivel" description="O bloco atual aparece aqui apos gerar o programa." />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="semana" className="space-y-4">
          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Semana atual</CardTitle>
              <CardDescription>
                Grade fixa com musculacao de segunda a sexta pela manha e beach tennis segunda, terca, quarta e domingo.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {sessionsByDay.map((day) => (
                <div key={day.key} className="space-y-3 rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{day.label}</p>
                    <p className="text-xs text-muted-foreground">Semana {currentWeekNumber}</p>
                  </div>

                  {[day.morning, day.night].map((session, index) =>
                    session ? (
                      <button
                        key={session.id}
                        type="button"
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-colors",
                          session.log
                            ? "border-success/30 bg-success-muted"
                            : "border-border bg-card/70 hover:border-primary/40",
                        )}
                        onClick={() => {
                          openSession(session.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{formatTimeSlot(session.time_slot)}</Badge>
                          <Badge variant="secondary">{formatSessionBadge(session.session_type)}</Badge>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">{session.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{session.log ? "Sessao registrada" : "Sessao pendente"}</p>
                      </button>
                    ) : (
                      <div key={`${day.key}-${index}`} className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                        Sem sessao
                      </div>
                    ),
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessao" className="space-y-4" ref={sessionTabRef}>
          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Registro de sessao</CardTitle>
              <CardDescription>Prescricao, execucao por serie e sugestao de progressao baseada na ultima resposta do treino.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="min-w-0 space-y-5">
                  <div className="space-y-2.5">
                    <Label>Escolha a sessao</Label>
                    <Select value={selectedSession?.id || ""} onValueChange={setSelectedSessionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma sessao" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessionsWithContext.map((session) => (
                          <SelectItem key={session.id} value={session.id} className="max-w-full">
                            <span className="block truncate">{`S${session.week_number} | ${formatDateLabel(session.session_date)} | ${session.title}`}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSession ? (
                    <>
                      <div className="rounded-2xl border border-border bg-background/30 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{formatLongDateLabel(selectedSession.session_date)}</Badge>
                          <Badge variant="secondary">{formatSessionBadge(selectedSession.session_type)}</Badge>
                          {selectedSession.block ? <Badge variant="outline">{selectedSession.block.focus_label}</Badge> : null}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold leading-tight text-foreground sm:text-xl">{selectedSession.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedSession.objective}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Duracao (min)</Label>
                          <Input value={draft.durationMinutes} onChange={(event) => updateDraftField("durationMinutes", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Session RPE</Label>
                          <Input value={draft.sessionRpe} onChange={(event) => updateDraftField("sessionRpe", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Peso corporal (kg)</Label>
                          <Input value={draft.bodyWeightKg} onChange={(event) => updateDraftField("bodyWeightKg", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Sono (h)</Label>
                          <Input value={draft.sleepHours} onChange={(event) => updateDraftField("sleepHours", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Readiness</Label>
                          <Input value={draft.readinessScore} onChange={(event) => updateDraftField("readinessScore", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Fadiga</Label>
                          <Input value={draft.fatigueScore} onChange={(event) => updateDraftField("fatigueScore", event.target.value)} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notas da sessao</Label>
                        <Textarea value={draft.notesMd} onChange={(event) => updateDraftField("notesMd", event.target.value)} className="min-h-[110px]" />
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button onClick={() => void saveSessionLog(selectedSession, draft)} disabled={savingSession} className="h-12 w-full gap-2 sm:w-auto">
                          <Dumbbell className="h-4 w-4" />
                          {savingSession ? "Salvando..." : "Salvar sessao"}
                        </Button>
                        <Button type="button" variant="outline" onClick={revertSessionDraft} disabled={savingSession} className="h-12 w-full gap-2 sm:w-auto">
                          <RotateCcw className="h-4 w-4" />
                          Reverter alteracoes
                        </Button>
                        {selectedSession.log ? (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setSessionDeleteOpen(true)}
                            disabled={savingSession}
                            className="h-12 w-full gap-2 sm:w-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir registro
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={Dumbbell}
                      title="Selecione uma sessao"
                      description="Escolha uma sessao planejada para registrar carga, RPE e evolucao por exercicio."
                    />
                  )}
                </div>

                <div className="min-w-0 space-y-4">
                  {selectedSession ? (
                    <>
                      {progressionHints.length > 0 ? (
                        <div className="rounded-2xl border border-border bg-background/30 p-4">
                          <p className="text-eyebrow font-semibold uppercase tracking-label text-primary">Sugestao de progressao</p>
                          <div className="mt-3 space-y-2">
                            {progressionHints.map((hint) => (
                              <div key={hint.exerciseId} className="rounded-xl border border-border bg-card/80 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-foreground">{hint.exerciseName}</p>
                                  <Badge variant="secondary">{pickProgressionLabel(hint.recommendation.action)}</Badge>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">{hint.recommendation.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selectedSession.exercises.map((exercise) => {
                        const hint = progressionHints.find((item) => item.exerciseId === exercise.id);
                        const rows = draft.exerciseSets[exercise.id] || [];

                        return (
                          <Card key={exercise.id} className="rounded-2xl border-border bg-card/95">
                            <CardHeader>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{exercise.category}</Badge>
                                <Badge variant="secondary">
                                  {exercise.prescribed_sets} x {formatExerciseTarget(exercise.target_rep_min, exercise.target_rep_max, exercise.load_mode)}
                                </Badge>
                                {exercise.target_rpe ? <Badge variant="outline">RPE {exercise.target_rpe}</Badge> : null}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <CardTitle className="min-w-0 flex-1 break-words text-lg">{exercise.exercise_name}</CardTitle>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSwapTarget({ id: exercise.id, name: exercise.exercise_name, category: exercise.category });
                                      setSwapSearch("");
                                    }}
                                    disabled={swappingExerciseId === exercise.id}
                                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                                    aria-label="Trocar exercicio"
                                    title="Trocar exercicio"
                                  >
                                    <Repeat className="h-4 w-4" />
                                  </button>
                                  {getExerciseInfo(exercise.exercise_name) ? (
                                    <button
                                      type="button"
                                      onClick={() => setOpenInfoId(openInfoId === exercise.id ? null : exercise.id)}
                                      className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                      aria-label="Ver descricao do exercicio"
                                    >
                                      <Info className="h-4 w-4" />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <CardDescription>{exercise.progression_rule}</CardDescription>
                              {openInfoId === exercise.id ? (() => {
                                const info = getExerciseInfo(exercise.exercise_name);
                                return info ? (
                                  <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                                    <p className="mb-2 leading-relaxed">{info.description}</p>
                                    <a
                                      href={info.videoUrl ?? info.youtubeSearch}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 hover:text-primary hover:underline"
                                    >
                                      {info.videoUrl ? "Ver vídeo ↗" : "Ver no YouTube ↗"}
                                    </a>
                                  </div>
                                ) : null;
                              })() : null}
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {hint ? (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                                  {pickProgressionLabel(hint.recommendation.action)}: {hint.recommendation.reason}
                                </div>
                              ) : null}

                              {rows.map((row, rowIndex) => (
                                <div key={`${exercise.id}-${row.setNumber}`} className="rounded-xl border border-border bg-background/30 p-3">
                                  <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm font-semibold text-foreground">Serie {row.setNumber}</p>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Checkbox
                                          checked={row.completed}
                                          onCheckedChange={(checked) => updateExerciseSet(exercise.id, rowIndex, { completed: checked === true })}
                                        />
                                        Concluida
                                      </label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => clearExerciseSet(exercise.id, rowIndex)}
                                        className="h-8 px-2 text-xs"
                                      >
                                        Limpar serie
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <div className="space-y-2">
                                      <Label>Reps</Label>
                                      <Input
                                        value={row.repsCompleted}
                                        onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { repsCompleted: event.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Carga (kg)</Label>
                                      <Input
                                        value={row.loadKg}
                                        onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { loadKg: event.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>RPE</Label>
                                      <Input
                                        value={row.rpe}
                                        onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { rpe: event.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>{exercise.load_mode === "time" ? "Tempo (s)" : exercise.load_mode === "distance" ? "Distancia (m)" : "Observacao rapida"}</Label>
                                      {exercise.load_mode === "time" ? (
                                        <Input
                                          value={row.durationSeconds}
                                          onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { durationSeconds: event.target.value })}
                                        />
                                      ) : exercise.load_mode === "distance" ? (
                                        <Input
                                          value={row.distanceMeters}
                                          onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { distanceMeters: event.target.value })}
                                        />
                                      ) : (
                                        <Input
                                          value={row.notes}
                                          onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { notes: event.target.value })}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {exercise.load_mode === "time" || exercise.load_mode === "distance" ? (
                                    <div className="mt-3 space-y-2">
                                      <Label>Notas</Label>
                                      <Input
                                        value={row.notes}
                                        onChange={(event) => updateExerciseSet(exercise.id, rowIndex, { notes: event.target.value })}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </>
                  ) : (
                    <EmptyState
                      icon={Dumbbell}
                      title="Sem sessao selecionada"
                      description="Escolha uma sessao para ver exercicios, historico de series e sugestoes de progressao."
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="min-w-0 rounded-2xl border-border bg-card/95">
              <CardHeader>
                <CardTitle>Evolucao de carga e desempenho</CardTitle>
                <CardDescription>Session load combinado com estimativa de e1RM dos exercicios principais.</CardDescription>
              </CardHeader>
              <CardContent>
                {chartPoints.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[320px] w-full">
                    <LineChart data={chartPoints}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="left" width={48} />
                      <YAxis yAxisId="right" orientation="right" width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line yAxisId="left" type="monotone" dataKey="sessionLoad" stroke="var(--color-sessionLoad)" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="e1rm" stroke="var(--color-e1rm)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <EmptyState
                    icon={Zap}
                    title="Sem dados suficientes"
                    description="Registre sessoes e checkpoints para enxergar a curva de carga, e1RM e recuperacao."
                  />
                )}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card className="rounded-2xl border-border bg-card/95">
                <CardHeader>
                  <CardTitle>Checkpoint rapido</CardTitle>
                  <CardDescription>
                    {measurementDraft.measurementId
                      ? `Editando checkpoint de ${formatLongDateLabel(measurementDraft.measurementDate)}.`
                      : "Atualize peso, cintura e observacoes do ciclo."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Peso (kg)</Label>
                      <Input
                        value={measurementDraft.weightKg}
                        onChange={(event) => setMeasurementDraft((current) => ({ ...current, weightKg: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cintura (cm)</Label>
                      <Input
                        value={measurementDraft.waistCm}
                        onChange={(event) => setMeasurementDraft((current) => ({ ...current, waistCm: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={measurementDraft.notesMd}
                      onChange={(event) => setMeasurementDraft((current) => ({ ...current, notesMd: event.target.value }))}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button
                      className="gap-2"
                      onClick={async () => {
                        const saved = await saveMeasurement(measurementDraft);
                        if (saved) {
                          resetMeasurementEditor();
                        }
                      }}
                      disabled={savingMeasurement}
                    >
                      <Scale className="h-4 w-4" />
                      {savingMeasurement ? "Salvando..." : measurementDraft.measurementId ? "Atualizar checkpoint" : "Salvar checkpoint"}
                    </Button>
                    {measurementDraft.measurementId ? (
                      <Button type="button" variant="outline" onClick={resetMeasurementEditor} disabled={savingMeasurement}>
                        Voltar para hoje
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border bg-card/95">
                <CardHeader>
                  <CardTitle>Indicadores</CardTitle>
                  <CardDescription>Leitura rapida de aderencia e recuperacao.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-xl border border-border bg-background/30 p-3">
                    <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Sono recente</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {chartPoints.length > 0 && chartPoints[chartPoints.length - 1]?.sleepHours
                        ? `${chartPoints[chartPoints.length - 1].sleepHours.toFixed(1)} h`
                        : "Sem dado"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/30 p-3">
                    <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Aderencia mental</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{mentalAdherence}%</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/30 p-3">
                    <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Ultimo checkpoint</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {latestMeasurement ? formatDateLabel(latestMeasurement.measurement_date) : "Nao registrado"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader>
                <CardTitle>Historico fisico</CardTitle>
                <CardDescription>Ultimos checkpoints de composicao e percepcao do bloco.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {measurements.length > 0 ? (
                  measurements.slice(0, 6).map((measurement) => (
                    <div key={measurement.id} className="rounded-xl border border-border bg-background/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{formatLongDateLabel(measurement.measurement_date)}</p>
                        <Badge variant="secondary">{measurement.weight_kg ? `${measurement.weight_kg.toFixed(1)} kg` : "Sem peso"}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {measurement.waist_cm ? `Cintura ${measurement.waist_cm.toFixed(1)} cm.` : "Sem cintura registrada."}
                      </p>
                      {measurement.notes_md ? <p className="mt-2 text-sm text-foreground">{measurement.notes_md}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openMeasurementEditor(measurement)}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => setMeasurementPendingDelete(measurement)}>
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Scale}
                    title="Sem checkpoints"
                    description="Salve medidas para acompanhar peso, cintura e observacoes ao longo do plano."
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card/95">
              <CardHeader>
                <CardTitle>Historico mental</CardTitle>
                <CardDescription>Ultimos prompts aplicados e consistencia de rotina.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mentalEntries.length > 0 ? (
                  mentalEntries.slice(0, 7).map((entry) => {
                    const prompt = mentalPromptById.get(entry.prompt_id);
                    return (
                      <div key={entry.id} className="rounded-xl border border-border bg-background/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{prompt?.title || "Prompt mental"}</p>
                          <Badge
                            className={cn(
                              entry.applied
                                ? "border-success/30 bg-success-muted text-success-foreground"
                                : "border-border bg-background text-muted-foreground",
                            )}
                          >
                            {entry.applied ? "Aplicado" : "Nao aplicado"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatLongDateLabel(entry.entry_date)}</p>
                        {prompt?.cue ? <p className="mt-2 text-sm text-foreground">{prompt.cue}</p> : null}
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    icon={BrainCircuit}
                    title="Sem historico mental"
                    description="Marque a dica do dia como aplicada para iniciar o historico de aderencia mental."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="blocos" className="space-y-4">
          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Macro ciclo de 24 semanas</CardTitle>
              <CardDescription>Seis mesociclos de quatro semanas com deload e checkpoints nas semanas 4, 8, 12, 16, 20 e 24.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              {blocks.map((block) => {
                const isCurrent = currentWeekNumber >= block.week_start && currentWeekNumber <= block.week_end;
                return (
                  <article
                    key={block.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-background/30",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Bloco {block.block_index}</Badge>
                      <Badge variant="outline">{`Semanas ${block.week_start}-${block.week_end}`}</Badge>
                      {isCurrent ? <Badge className="border-primary/30 bg-primary/10 text-primary">Atual</Badge> : null}
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-foreground">{block.focus_label}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{block.volume_guidance}</p>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-border bg-card/80 p-3">
                        <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Intensidade</p>
                        <p className="mt-2 text-sm text-foreground">{block.intensity_guidance}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card/80 p-3">
                        <p className="text-eyebrow uppercase tracking-label text-muted-foreground">Checkpoint</p>
                        <p className="mt-2 text-sm text-foreground">
                          Semana {block.week_end} com volume reduzido, revisao de carga, medidas e ajuste fino de recuperacao.
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biblioteca" className="space-y-4">
          <Card className="rounded-2xl border-border bg-card/95">
            <CardHeader>
              <CardTitle>Biblioteca de exercicios</CardTitle>
              <CardDescription>
                {exerciseCatalog.length} exercicios catalogados. Filtre por padrao de movimento ou busque por nome.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative md:flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={librarySearch}
                    onChange={(event) => setLibrarySearch(event.target.value)}
                    placeholder="Buscar exercicio..."
                    className="pl-9"
                  />
                </div>
                <Select value={libraryCategory} onValueChange={setLibraryCategory}>
                  <SelectTrigger className="md:w-60">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {Array.from(new Set(exerciseCatalog.map((item) => item.category)))
                      .sort()
                      .map((category) => (
                        <SelectItem key={category} value={category}>
                          {EXERCISE_CATEGORY_LABELS[category] ?? category}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {(() => {
                const term = librarySearch.trim().toLowerCase();
                const filtered = exerciseCatalog.filter((item) => {
                  const matchesCategory = libraryCategory === "all" || item.category === libraryCategory;
                  const matchesSearch = !term || item.name.toLowerCase().includes(term);
                  return matchesCategory && matchesSearch;
                });

                if (!filtered.length) {
                  return (
                    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Nenhum exercicio encontrado. Ajuste o filtro ou a busca.
                    </p>
                  );
                }

                return (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((item) => (
                      <article key={item.id} className="rounded-xl border border-border bg-card/80 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {EXERCISE_CATEGORY_LABELS[item.category] ?? item.category}
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{item.description}</p>
                        {item.video_url ? (
                          <a
                            href={item.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary/80 hover:text-primary hover:underline"
                          >
                            Ver video ↗
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!swapTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSwapTarget(null);
            setSwapSearch("");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Trocar exercicio</DialogTitle>
            <DialogDescription>
              {swapTarget ? `Substituindo "${swapTarget.name}" (${EXERCISE_CATEGORY_LABELS[swapTarget.category] ?? swapTarget.category}).` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={swapSearch}
              onChange={(event) => setSwapSearch(event.target.value)}
              placeholder="Buscar exercicio compativel..."
              className="pl-9"
            />
          </div>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {(() => {
              if (!swapTarget) return null;
              const term = swapSearch.trim().toLowerCase();
              const compatible = exerciseCatalog
                .filter((item) => item.category === swapTarget.category && item.name !== swapTarget.name)
                .filter((item) => !term || item.name.toLowerCase().includes(term));

              if (!compatible.length) {
                return (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum exercicio compativel encontrado.
                  </p>
                );
              }

              return compatible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={swappingExerciseId === swapTarget.id}
                  onClick={async () => {
                    const ok = await swapSessionExercise({
                      exerciseId: swapTarget.id,
                      name: item.name,
                      category: item.category,
                    });
                    if (ok) {
                      setSwapTarget(null);
                      setSwapSearch("");
                    }
                  }}
                  className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-card/80 p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-foreground">{item.name}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>
                  {item.video_url ? (
                    <span className="text-xs font-medium text-primary/80">Vídeo disponível</span>
                  ) : null}
                </button>
              ));
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSwapTarget(null);
                setSwapSearch("");
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={sessionDeleteOpen}
        onOpenChange={setSessionDeleteOpen}
        itemLabel={selectedSession ? `o registro de ${selectedSession.title}` : "este registro"}
        onConfirm={async () => {
          const deleted = await deleteSessionLog(selectedSession);
          if (deleted) {
            setSessionDeleteOpen(false);
          }
        }}
      />
      <DeleteConfirmDialog
        open={!!measurementPendingDelete}
        onOpenChange={(open) => {
          if (!open) setMeasurementPendingDelete(null);
        }}
        itemLabel={measurementPendingDelete ? `o checkpoint de ${formatLongDateLabel(measurementPendingDelete.measurement_date)}` : "este checkpoint"}
        onConfirm={async () => {
          if (!measurementPendingDelete) return;
          const deleted = await deleteMeasurement(measurementPendingDelete.id);
          if (deleted) {
            if (measurementDraft.measurementId === measurementPendingDelete.id) {
              resetMeasurementEditor();
            }
            setMeasurementPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
