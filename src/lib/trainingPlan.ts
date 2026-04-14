import { getDateKeyInTimezone } from "@/lib/timeline";
import type {
  AthleteProfile,
  MentalGamePrompt,
  TrainingExerciseLoadMode,
  TrainingPrimaryGoal,
  TrainingDayOfWeek,
  TrainingSessionType,
  TrainingTimeSlot,
} from "@/types";

type BlockDefinition = {
  block_index: number;
  week_start: number;
  week_end: number;
  focus_key: string;
  focus_label: string;
  volume_guidance: string;
  intensity_guidance: string;
  base_rpe: number;
};

type ExerciseDraft = {
  exercise_name: string;
  category: string;
  prescribed_sets: number;
  target_rep_min: number | null;
  target_rep_max: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  load_mode: TrainingExerciseLoadMode;
  target_rpe: number | null;
  target_rir: number | null;
  progression_rule: string;
  notes: string | null;
};

type SessionTemplate = {
  day_of_week: TrainingDayOfWeek;
  time_slot: TrainingTimeSlot;
  session_type: TrainingSessionType;
  title: string;
  target_duration_minutes: number;
  objective: (block: BlockDefinition, deload: boolean) => string;
  exercises: (block: BlockDefinition, deload: boolean) => ExerciseDraft[];
};

export type BuiltTrainingProgram = {
  user_id: string;
  name: string;
  goal: TrainingPrimaryGoal;
  start_date: string;
  duration_weeks: number;
  status: "active";
  rationale_summary: string;
};

export type BuiltTrainingBlock = {
  user_id: string;
  block_index: number;
  week_start: number;
  week_end: number;
  focus_key: string;
  focus_label: string;
  volume_guidance: string;
  intensity_guidance: string;
  is_deload_block: boolean;
};

export type BuiltTrainingSession = {
  user_id: string;
  block_index: number;
  builder_key: string;
  week_number: number;
  session_date: string;
  day_of_week: TrainingDayOfWeek;
  time_slot: TrainingTimeSlot;
  session_type: TrainingSessionType;
  title: string;
  objective: string;
  target_duration_minutes: number;
  target_rpe: number | null;
  is_deload_week: boolean;
};

export type BuiltTrainingSessionExercise = {
  user_id: string;
  session_builder_key: string;
  prescribed_order: number;
  exercise_name: string;
  category: string;
  prescribed_sets: number;
  target_rep_min: number | null;
  target_rep_max: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  load_mode: TrainingExerciseLoadMode;
  target_rpe: number | null;
  target_rir: number | null;
  progression_rule: string;
  notes: string | null;
};

export type TrainingPlanBuildResult = {
  program: BuiltTrainingProgram;
  blocks: BuiltTrainingBlock[];
  sessions: BuiltTrainingSession[];
  sessionExercises: BuiltTrainingSessionExercise[];
};

export type LoadProgressionRecommendation = {
  action: "increase" | "maintain" | "reduce_volume";
  recommended_load_increment_kg: number | null;
  remove_main_sets: number;
  skip_finisher: boolean;
  reason: string;
};

const DAY_OFFSETS: Record<TrainingDayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const BLOCKS: BlockDefinition[] = [
  { block_index: 1, week_start: 1, week_end: 4, focus_key: "reconditioning", focus_label: "Recondicionamento", volume_guidance: "Base aeróbia, técnica e tolerância tecidual.", intensity_guidance: "RPE 6 a 7.", base_rpe: 6.5 },
  { block_index: 2, week_start: 5, week_end: 8, focus_key: "functional_hypertrophy", focus_label: "Hipertrofia funcional", volume_guidance: "Mais volume, unilateral e core.", intensity_guidance: "RPE 7 a 8.", base_rpe: 7.25 },
  { block_index: 3, week_start: 9, week_end: 12, focus_key: "strength_one", focus_label: "Força I", volume_guidance: "Básicos pesados e manutenção de massa.", intensity_guidance: "RPE 7.5 a 8.5.", base_rpe: 7.75 },
  { block_index: 4, week_start: 13, week_end: 16, focus_key: "strength_transfer", focus_label: "Força II + transferência", volume_guidance: "Menos volume bruto, mais intenção de velocidade.", intensity_guidance: "RPE 7.5 a 8.5.", base_rpe: 8 },
  { block_index: 5, week_start: 17, week_end: 20, focus_key: "power_rsa", focus_label: "Potência + velocidade + RSA", volume_guidance: "Alta qualidade e repeated sprint ability.", intensity_guidance: "RPE 7 a 8.", base_rpe: 7.75 },
  { block_index: 6, week_start: 21, week_end: 24, focus_key: "consolidation", focus_label: "Consolidação de performance + recomposição", volume_guidance: "Volume enxuto e manutenção.", intensity_guidance: "RPE 7 a 8.", base_rpe: 7.5 },
];

function parseDateKeyUtc(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysToDateKey(dateKey: string, days: number) {
  const next = parseDateKeyUtc(dateKey);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function withDeloadSets(baseSets: number, deload: boolean, floor = 1) {
  return deload ? Math.max(floor, baseSets - 1) : baseSets;
}

function makeExercise(
  draft: ExerciseDraft,
  deload: boolean,
  kind: "main" | "secondary" | "accessory" = "secondary",
) {
  return {
    ...draft,
    prescribed_sets: withDeloadSets(draft.prescribed_sets, deload, kind === "main" ? 2 : 1),
  };
}

function mainLiftRule(label: string) {
  return `Double progression no ${label}: subir a carga quando todas as séries baterem o topo da faixa com técnica boa e RPE adequado.`;
}

function getBlockForWeek(weekNumber: number) {
  return BLOCKS.find((block) => weekNumber >= block.week_start && weekNumber <= block.week_end) || BLOCKS[0];
}

function isDeloadWeek(weekNumber: number) {
  return weekNumber % 4 === 0;
}

function upperDayExercises(block: BlockDefinition, deload: boolean) {
  const main =
    block.focus_key === "strength_one" || block.focus_key === "consolidation"
      ? { press: "Supino com barra", row: "Remada apoiada", sets: 5, repMin: 4, repMax: 6 }
      : block.focus_key === "strength_transfer"
        ? { press: "Supino com halteres neutros", row: "Remada apoiada", sets: 4, repMin: 4, repMax: 5 }
        : block.focus_key === "power_rsa"
          ? { press: "Landmine press", row: "Puxada vertical", sets: 4, repMin: 4, repMax: 6 }
          : block.focus_key === "functional_hypertrophy"
            ? { press: "Supino com barra", row: "Remada unilateral no cabo", sets: 4, repMin: 6, repMax: 8 }
            : { press: "Supino com halteres", row: "Remada apoiada", sets: 3, repMin: 6, repMax: 8 };

  return [
    makeExercise({ exercise_name: main.press, category: "main", prescribed_sets: main.sets, target_rep_min: main.repMin, target_rep_max: main.repMax, rest_seconds: 150, tempo: "20X1", load_mode: "rpe", target_rpe: 8, target_rir: 2, progression_rule: mainLiftRule(main.press), notes: null }, deload, "main"),
    makeExercise({ exercise_name: main.row, category: "main", prescribed_sets: Math.max(3, main.sets - 1), target_rep_min: main.repMin, target_rep_max: Math.max(main.repMax, main.repMin + 1), rest_seconds: 120, tempo: "21X1", load_mode: "rpe", target_rpe: 8, target_rir: 2, progression_rule: mainLiftRule(main.row), notes: null }, deload, "main"),
    makeExercise({ exercise_name: "Puxada vertical", category: "secondary", prescribed_sets: 3, target_rep_min: 6, target_rep_max: 10, rest_seconds: 90, tempo: "21X1", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Subir quando sobrar folga técnica.", notes: null }, deload),
    makeExercise({ exercise_name: "Face pull", category: "prehab", prescribed_sets: 2, target_rep_min: 12, target_rep_max: 15, rest_seconds: 45, tempo: "2112", load_mode: "rpe", target_rpe: 7, target_rir: 3, progression_rule: "Qualidade de escápula primeiro.", notes: null }, deload, "accessory"),
    makeExercise({ exercise_name: "Rotacao externa com cabo", category: "prehab", prescribed_sets: 2, target_rep_min: 12, target_rep_max: 15, rest_seconds: 45, tempo: "2112", load_mode: "rpe", target_rpe: 7, target_rir: 3, progression_rule: "Manguito limpo e sem compensação.", notes: null }, deload, "accessory"),
    makeExercise({ exercise_name: "Pronacao e supinacao de antebraco", category: "prehab", prescribed_sets: 2, target_rep_min: 10, target_rep_max: 15, rest_seconds: 45, tempo: "2111", load_mode: "rpe", target_rpe: 7, target_rir: 3, progression_rule: "Subir progressivamente sem irritar cotovelo.", notes: null }, deload, "accessory"),
  ];
}

function powerDayExercises(block: BlockDefinition, deload: boolean) {
  const sprintSets = block.focus_key === "power_rsa" ? 8 : block.focus_key === "reconditioning" ? 6 : 7;
  const bikeExtendedSets = block.focus_key === "power_rsa" ? 6 : 4;
  return [
    makeExercise({ exercise_name: "CMJ", category: "power", prescribed_sets: 4, target_rep_min: 3, target_rep_max: 3, rest_seconds: 75, tempo: "X", load_mode: "bodyweight", target_rpe: 7, target_rir: null, progression_rule: "Parar antes de perder altura no salto.", notes: null }, deload, "main"),
    makeExercise({ exercise_name: "Lateral bound", category: "power", prescribed_sets: 3, target_rep_min: 4, target_rep_max: 4, rest_seconds: 60, tempo: "X", load_mode: "bodyweight", target_rpe: 7, target_rir: null, progression_rule: "Aumentar amplitude só mantendo aterrissagem limpa.", notes: null }, deload),
    makeExercise({ exercise_name: "Jump shrug com barra", category: "power", prescribed_sets: 4, target_rep_min: 4, target_rep_max: 4, rest_seconds: 75, tempo: "X", load_mode: "rpe", target_rpe: 7, target_rir: null, progression_rule: "Explodir com barra leve sem transformar em levantamento pesado.", notes: "Barra leve ou com anilhas pequenas." }, deload),
    makeExercise({ exercise_name: "Rotacao explosiva no cabo", category: "power", prescribed_sets: 4, target_rep_min: 6, target_rep_max: 6, rest_seconds: 60, tempo: "X", load_mode: "rpe", target_rpe: 7, target_rir: null, progression_rule: "Velocidade do quadril até as mãos, sem perder o eixo.", notes: "Alternar lados a cada série." }, deload),
    makeExercise({ exercise_name: "Bike sprint", category: "conditioning", prescribed_sets: sprintSets, target_rep_min: 10, target_rep_max: 10, rest_seconds: 50, tempo: null, load_mode: "time", target_rpe: 8, target_rir: null, progression_rule: "Manter potência alta em todos os tiros.", notes: "10 segundos forte / 50 fácil." }, deload),
    makeExercise({ exercise_name: "Bike sprint estendido", category: "conditioning", prescribed_sets: bikeExtendedSets, target_rep_min: 15, target_rep_max: 15, rest_seconds: 45, tempo: null, load_mode: "time", target_rpe: 8, target_rir: null, progression_rule: "Sustentar cadência alta sem travar as pernas.", notes: "15 segundos forte / 45 fácil." }, deload),
    makeExercise({ exercise_name: "Pallof press", category: "core", prescribed_sets: 3, target_rep_min: 8, target_rep_max: 10, rest_seconds: 45, tempo: "2111", load_mode: "rpe", target_rpe: 7, target_rir: 3, progression_rule: "Estabilidade anti-rotação acima de carga.", notes: null }, deload, "accessory"),
  ];
}

function recoveryDayExercises(_block: BlockDefinition, deload: boolean): ExerciseDraft[] {
  return [
    { exercise_name: "Zone 2 bike", category: "recovery", prescribed_sets: 1, target_rep_min: deload ? 20 : 30, target_rep_max: deload ? 20 : 30, rest_seconds: null, tempo: null, load_mode: "time" as TrainingExerciseLoadMode, target_rpe: 5, target_rir: null, progression_rule: "Ritmo conversável.", notes: "Base aeróbia sem fadiga." },
    { exercise_name: "Mobilidade quadril, tornozelo e toracica", category: "mobility", prescribed_sets: 1, target_rep_min: 10, target_rep_max: 10, rest_seconds: null, tempo: null, load_mode: "time" as TrainingExerciseLoadMode, target_rpe: 4, target_rir: null, progression_rule: "Qualidade de movimento acima de volume.", notes: "Circuito de 10 minutos." },
    makeExercise({ exercise_name: "Rotacao externa com cabo", category: "prehab", prescribed_sets: 2, target_rep_min: 12, target_rep_max: 15, rest_seconds: 30, tempo: "2112", load_mode: "rpe", target_rpe: 6.5, target_rir: 3, progression_rule: "Sem compensação no tronco.", notes: null }, deload, "accessory"),
    makeExercise({ exercise_name: "Trap-3 raise", category: "prehab", prescribed_sets: 2, target_rep_min: 10, target_rep_max: 12, rest_seconds: 30, tempo: "2112", load_mode: "rpe", target_rpe: 6.5, target_rir: 3, progression_rule: "Escápula limpa do começo ao fim.", notes: null }, deload, "accessory"),
    makeExercise({ exercise_name: "Copenhagen plank", category: "core", prescribed_sets: 2, target_rep_min: 20, target_rep_max: 30, rest_seconds: 30, tempo: null, load_mode: "time", target_rpe: 7, target_rir: null, progression_rule: "Progredir primeiro pelo tempo.", notes: null }, deload, "accessory"),
  ];
}

function lowerDayExercises(block: BlockDefinition, deload: boolean) {
  const main =
    block.focus_key === "functional_hypertrophy"
      ? { squat: "Front squat", hinge: "RDL", sets: 4, repMin: 6, repMax: 8 }
      : block.focus_key === "strength_one"
        ? { squat: "Safety bar squat", hinge: "Trap-bar deadlift", sets: 5, repMin: 4, repMax: 6 }
        : block.focus_key === "strength_transfer"
          ? { squat: "Front squat", hinge: "Trap-bar deadlift", sets: 4, repMin: 3, repMax: 5 }
          : block.focus_key === "power_rsa"
            ? { squat: "Trap-bar deadlift", hinge: "Box jump baixo", sets: 4, repMin: 3, repMax: 3 }
            : block.focus_key === "consolidation"
              ? { squat: "Front squat", hinge: "Hip thrust", sets: 3, repMin: 3, repMax: 5 }
              : { squat: "Trap-bar deadlift", hinge: "Bulgarian split squat", sets: 3, repMin: 5, repMax: 6 };

  return [
    makeExercise({ exercise_name: main.squat, category: "main", prescribed_sets: main.sets, target_rep_min: main.repMin, target_rep_max: main.repMax, rest_seconds: 180, tempo: "20X1", load_mode: "rpe", target_rpe: 8, target_rir: 2, progression_rule: mainLiftRule(main.squat), notes: null }, deload, "main"),
    makeExercise({ exercise_name: main.hinge, category: "main", prescribed_sets: Math.max(3, main.sets - 1), target_rep_min: main.repMin, target_rep_max: main.repMax, rest_seconds: 150, tempo: main.hinge === "Box jump baixo" ? "X" : "20X1", load_mode: main.hinge === "Box jump baixo" ? "bodyweight" : "rpe", target_rpe: 7.5, target_rir: main.hinge === "Box jump baixo" ? null : 2, progression_rule: mainLiftRule(main.hinge), notes: main.hinge === "Box jump baixo" ? "Aterrissagem leve." : null }, deload, "main"),
    makeExercise({ exercise_name: "Bulgarian split squat", category: "secondary", prescribed_sets: 3, target_rep_min: 6, target_rep_max: 8, rest_seconds: 75, tempo: "2111", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Eixo e profundidade consistentes.", notes: null }, deload),
    makeExercise({ exercise_name: "Hamstring curl", category: "accessory", prescribed_sets: 3, target_rep_min: 6, target_rep_max: 12, rest_seconds: 60, tempo: "2111", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Posterior forte sem roubar lombar.", notes: null }, deload, "accessory"),
    makeExercise({ exercise_name: "Calf raise", category: "accessory", prescribed_sets: 2, target_rep_min: 10, target_rep_max: 15, rest_seconds: 45, tempo: "2211", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Amplitude total em toda repetição.", notes: null }, deload, "accessory"),
    makeExercise({ exercise_name: "Pallof press", category: "core", prescribed_sets: 2, target_rep_min: 8, target_rep_max: 10, rest_seconds: 45, tempo: "2111", load_mode: "rpe", target_rpe: 7, target_rir: 3, progression_rule: "Controle anti-rotação.", notes: null }, deload, "accessory"),
  ];
}

function fullBodyExercises(block: BlockDefinition, deload: boolean): ExerciseDraft[] {
  return [
    makeExercise({ exercise_name: "Step-up", category: "secondary", prescribed_sets: block.focus_key === "functional_hypertrophy" ? 3 : 2, target_rep_min: 8, target_rep_max: 10, rest_seconds: 60, tempo: "20X1", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Subir quando a pélvis estiver estável.", notes: null }, deload),
    makeExercise({ exercise_name: "Supino inclinado com halteres", category: "secondary", prescribed_sets: 2, target_rep_min: 6, target_rep_max: 10, rest_seconds: 75, tempo: "20X1", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Subir gradualmente mantendo velocidade.", notes: null }, deload),
    makeExercise({ exercise_name: "Remada unilateral no cabo", category: "secondary", prescribed_sets: 2, target_rep_min: 8, target_rep_max: 10, rest_seconds: 60, tempo: "2111", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Qualidade antes de carga.", notes: null }, deload),
    makeExercise({ exercise_name: "Hip thrust", category: "secondary", prescribed_sets: 3, target_rep_min: 6, target_rep_max: 8, rest_seconds: 75, tempo: "20X1", load_mode: "rpe", target_rpe: 7.5, target_rir: 2, progression_rule: "Explodir e segurar o topo.", notes: null }, deload),
    makeExercise({ exercise_name: "Farmer carry", category: "carry", prescribed_sets: 3, target_rep_min: 30, target_rep_max: 30, rest_seconds: 45, tempo: null, load_mode: "distance", target_rpe: 7.5, target_rir: null, progression_rule: "Aumentar carga sem perder postura.", notes: "30 metros por repetição." }, deload, "accessory"),
    { exercise_name: "Bike finisher", category: "conditioning", prescribed_sets: deload ? 4 : 6, target_rep_min: 30, target_rep_max: 30, rest_seconds: 30, tempo: null, load_mode: "time" as TrainingExerciseLoadMode, target_rpe: 8, target_rir: null, progression_rule: "Cortar se a recuperação estiver ruim.", notes: "30 segundos forte / 30 leve." },
  ];
}

function beachTennisSessionExercises(): ExerciseDraft[] {
  return [
    { exercise_name: "Beach tennis", category: "sport", prescribed_sets: 1, target_rep_min: 75, target_rep_max: 90, rest_seconds: null, tempo: null, load_mode: "time" as TrainingExerciseLoadMode, target_rpe: 7, target_rir: null, progression_rule: "Registrar duração real e sRPE para controlar a carga semanal.", notes: "Sessão específica de quadra." },
  ];
}

const WEEKLY_TEMPLATES: SessionTemplate[] = [
  { day_of_week: "monday", time_slot: "morning", session_type: "strength", title: "Força superior + escápula + antebraço", target_duration_minutes: 80, objective: (block, deload) => deload ? `Reduzir volume e manter qualidade de força superior no bloco ${block.focus_label}.` : `Construir força superior útil para golpes e estabilidade escapular no bloco ${block.focus_label}.`, exercises: upperDayExercises },
  { day_of_week: "monday", time_slot: "night", session_type: "beach_tennis", title: "Beach tennis noturno", target_duration_minutes: 90, objective: (_block, deload) => deload ? "Sessão técnica com percepção de esforço controlada." : "Aplicar consistência, leitura de bola e execução sob fadiga moderada.", exercises: () => beachTennisSessionExercises() },
  { day_of_week: "tuesday", time_slot: "morning", session_type: "power", title: "Potência + velocidade + rotação", target_duration_minutes: 75, objective: (block, deload) => deload ? `Lapidar potência e velocidade sem gerar fadiga residual no bloco ${block.focus_label}.` : `Desenvolver potência, rotação e repeated sprint ability no bloco ${block.focus_label}.`, exercises: powerDayExercises },
  { day_of_week: "tuesday", time_slot: "night", session_type: "beach_tennis", title: "Beach tennis noturno", target_duration_minutes: 90, objective: () => "Sessão de quadra com foco em tomada de decisão, saque/retorno e transições.", exercises: () => beachTennisSessionExercises() },
  { day_of_week: "wednesday", time_slot: "morning", session_type: "recovery", title: "Recuperação ativa + zone 2 + mobilidade", target_duration_minutes: 60, objective: (_block, deload) => deload ? "Checkpoint de recuperação, mobilidade e controle de carga na semana de deload." : "Acelerar recuperação, sustentar ombros saudáveis e manter base aeróbia.", exercises: recoveryDayExercises },
  { day_of_week: "wednesday", time_slot: "night", session_type: "beach_tennis", title: "Beach tennis noturno", target_duration_minutes: 90, objective: () => "Sessão de quadra com foco em padrão técnico, comunicação e consistência.", exercises: () => beachTennisSessionExercises() },
  { day_of_week: "thursday", time_slot: "morning", session_type: "strength", title: "Força inferior principal", target_duration_minutes: 80, objective: (block, deload) => deload ? "Manter força inferior com volume reduzido e sair inteiro para o restante da semana." : `Construir força de membros inferiores, desaceleração e transferência para areia no bloco ${block.focus_label}.`, exercises: lowerDayExercises },
  { day_of_week: "friday", time_slot: "morning", session_type: "full_body", title: "Full body funcional + posterior + carries", target_duration_minutes: 75, objective: (_block, deload) => deload ? "Consolidar a semana, manter estímulo muscular e baixar fadiga sistêmica." : "Fechar a semana com full body funcional, posterior, carries e acabamento metabólico leve.", exercises: fullBodyExercises },
  { day_of_week: "sunday", time_slot: "night", session_type: "beach_tennis", title: "Beach tennis dominical", target_duration_minutes: 90, objective: () => "Jogo/treino de quadra para manter volume específico e leitura tática.", exercises: () => beachTennisSessionExercises() },
];

export function buildTrainingPlan({
  athleteProfile,
}: {
  athleteProfile: Pick<AthleteProfile, "user_id" | "primary_goal" | "program_start_date">;
  now?: Date;
}): TrainingPlanBuildResult {
  const program: BuiltTrainingProgram = {
    user_id: athleteProfile.user_id,
    name: "Beach Tennis | Periodização 24 semanas",
    goal: athleteProfile.primary_goal,
    start_date: athleteProfile.program_start_date,
    duration_weeks: 24,
    status: "active",
    rationale_summary: "Macro ciclo orientado por força, potência, recuperação e carga concorrente bem distribuída para beach tennis.",
  };

  const blocks: BuiltTrainingBlock[] = BLOCKS.map((block) => ({
    user_id: athleteProfile.user_id,
    block_index: block.block_index,
    week_start: block.week_start,
    week_end: block.week_end,
    focus_key: block.focus_key,
    focus_label: block.focus_label,
    volume_guidance: block.volume_guidance,
    intensity_guidance: block.intensity_guidance,
    is_deload_block: true,
  }));

  const sessions: BuiltTrainingSession[] = [];
  const sessionExercises: BuiltTrainingSessionExercise[] = [];

  for (let weekNumber = 1; weekNumber <= 24; weekNumber += 1) {
    const block = getBlockForWeek(weekNumber);
    const deload = isDeloadWeek(weekNumber);
    const weekStart = addDaysToDateKey(athleteProfile.program_start_date, (weekNumber - 1) * 7);

    for (const template of WEEKLY_TEMPLATES) {
      const builderKey = `wk-${String(weekNumber).padStart(2, "0")}-${template.day_of_week}-${template.time_slot}`;
      sessions.push({
        user_id: athleteProfile.user_id,
        block_index: block.block_index,
        builder_key: builderKey,
        week_number: weekNumber,
        session_date: addDaysToDateKey(weekStart, DAY_OFFSETS[template.day_of_week]),
        day_of_week: template.day_of_week,
        time_slot: template.time_slot,
        session_type: template.session_type,
        title: template.title,
        objective: template.objective(block, deload),
        target_duration_minutes: template.target_duration_minutes,
        target_rpe: template.session_type === "beach_tennis" ? 7 : Number((deload ? Math.max(5.5, block.base_rpe - 1) : block.base_rpe).toFixed(1)),
        is_deload_week: deload,
      });

      template.exercises(block, deload).forEach((exercise, index) => {
        sessionExercises.push({
          user_id: athleteProfile.user_id,
          session_builder_key: builderKey,
          prescribed_order: index + 1,
          exercise_name: exercise.exercise_name,
          category: exercise.category,
          prescribed_sets: exercise.prescribed_sets,
          target_rep_min: exercise.target_rep_min,
          target_rep_max: exercise.target_rep_max,
          rest_seconds: exercise.rest_seconds,
          tempo: exercise.tempo,
          load_mode: exercise.load_mode,
          target_rpe: exercise.target_rpe,
          target_rir: exercise.target_rir,
          progression_rule: exercise.progression_rule,
          notes: exercise.notes,
        });
      });
    }
  }

  return { program, blocks, sessions, sessionExercises };
}

export function getMentalGameDayOffset({ rotationStartedOn, now, timezone }: { rotationStartedOn: string; now: Date; timezone: string }) {
  const todayKey = getDateKeyInTimezone(now, timezone);
  return Math.max(0, Math.floor((parseDateKeyUtc(todayKey).getTime() - parseDateKeyUtc(rotationStartedOn).getTime()) / 86400000));
}

export function selectMentalGamePrompt<T extends Pick<MentalGamePrompt, "id" | "position">>({
  prompts,
  rotationStartedOn,
  now,
  timezone,
}: {
  prompts: T[];
  rotationStartedOn: string;
  now: Date;
  timezone: string;
}) {
  if (prompts.length === 0) return null;
  const offset = getMentalGameDayOffset({ rotationStartedOn, now, timezone });
  return [...prompts].sort((left, right) => left.position - right.position)[offset % prompts.length] || null;
}

export function recommendLoadProgression({
  target_rep_min,
  target_rep_max,
  target_rpe,
  reps_completed,
  set_rpe,
  load_increment_lower_kg,
  load_increment_upper_kg,
  emphasis,
  readiness_score,
  sleep_hours,
  previous_beach_tennis_rpe,
}: {
  target_rep_min: number;
  target_rep_max: number;
  target_rpe: number;
  reps_completed: number[];
  set_rpe: number[];
  load_increment_lower_kg: number;
  load_increment_upper_kg: number;
  emphasis: "lower" | "upper";
  readiness_score: number | null;
  sleep_hours: number | null;
  previous_beach_tennis_rpe: number | null;
}): LoadProgressionRecommendation {
  const poorRecovery = (readiness_score !== null && readiness_score <= 2) || (sleep_hours !== null && sleep_hours < 6) || (previous_beach_tennis_rpe !== null && previous_beach_tennis_rpe >= 7);
  if (poorRecovery) {
    return { action: "reduce_volume", recommended_load_increment_kg: null, remove_main_sets: 1, skip_finisher: true, reason: "Recuperação insuficiente para sustentar o volume normal da sessão." };
  }

  const hitTopRange = reps_completed.length > 0 && reps_completed.every((reps) => reps >= target_rep_max);
  const withinTargetRpe = set_rpe.length > 0 && set_rpe.every((rpe) => rpe <= target_rpe);
  if (hitTopRange && withinTargetRpe) {
    return { action: "increase", recommended_load_increment_kg: emphasis === "lower" ? load_increment_lower_kg : load_increment_upper_kg, remove_main_sets: 0, skip_finisher: false, reason: "Todas as séries bateram o topo da faixa com esforço controlado." };
  }

  const underTarget = reps_completed.some((reps) => reps < target_rep_min);
  const overRpe = set_rpe.some((rpe) => rpe > target_rpe + 0.5);
  return { action: "maintain", recommended_load_increment_kg: null, remove_main_sets: 0, skip_finisher: false, reason: underTarget || overRpe ? "Manter carga até estabilizar reps e percepção de esforço." : "Sessão estável; repetir antes de subir a carga." };
}


