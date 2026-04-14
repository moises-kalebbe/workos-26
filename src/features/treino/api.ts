import { db } from "@/lib/dbClient";
import { buildTrainingPlan } from "@/lib/trainingPlan";
import type {
  AthleteMeasurement,
  AthleteProfile,
  MentalGameEntry,
  MentalGamePrompt,
  TrainingBlock,
  TrainingExerciseLog,
  TrainingLog,
  TrainingProgram,
  TrainingSession,
  TrainingSessionExercise,
} from "@/types";

const LEGACY_TRAINING_EXERCISE_OVERRIDES: Record<string, Partial<TrainingSessionExercise>> = {
  "Medicine ball scoop toss": {
    exercise_name: "Jump shrug com barra",
    rest_seconds: 75,
    notes: "Barra leve ou com anilhas pequenas.",
    progression_rule: "Explodir com barra leve sem transformar em levantamento pesado.",
  },
  "Rotational shot put throw": {
    exercise_name: "Rotacao explosiva no cabo",
    target_rep_min: 6,
    target_rep_max: 6,
    notes: "Alternar lados a cada série.",
    progression_rule: "Velocidade do quadril até as mãos, sem perder o eixo.",
  },
  "Shuttle curto": {
    exercise_name: "Bike sprint estendido",
    load_mode: "time",
    target_rep_min: 15,
    target_rep_max: 15,
    notes: "15 segundos forte / 45 fácil.",
    progression_rule: "Sustentar cadência alta sem travar as pernas.",
  },
};

function normalizeLegacyTrainingExercise(exercise: TrainingSessionExercise): TrainingSessionExercise {
  const override = LEGACY_TRAINING_EXERCISE_OVERRIDES[exercise.exercise_name];
  return override ? { ...exercise, ...override } : exercise;
}

export const treinoApi = {
  db,
  async getTimezone() {
    return db.from("profiles").select("timezone").maybeSingle();
  },
  async getProfile() {
    return db.from("athlete_profiles").select("*").maybeSingle() as Promise<{ data: AthleteProfile | null; error: { message: string } | null }>;
  },
  async getPrograms() {
    return db.from("training_programs").select("*").order("start_date", { ascending: false }) as Promise<{ data: TrainingProgram[] | null; error: { message: string } | null }>;
  },
  async getBlocks(programId: string) {
    return db.from("training_blocks").select("*").eq("training_program_id", programId).order("block_index") as Promise<{ data: TrainingBlock[] | null; error: { message: string } | null }>;
  },
  async getSessions(programId: string) {
    return db.from("training_sessions").select("*").eq("training_program_id", programId).order("session_date", { ascending: true }) as Promise<{ data: TrainingSession[] | null; error: { message: string } | null }>;
  },
  async getSessionExercises(sessionIds: string[]) {
    if (!sessionIds.length) return { data: [], error: null } as { data: TrainingSessionExercise[]; error: null };
    const result = await db.from("training_session_exercises").select("*").in("training_session_id", sessionIds).order("prescribed_order", { ascending: true }) as { data: TrainingSessionExercise[] | null; error: { message: string } | null };
    if (result.error || !result.data) return result;

    return {
      data: result.data.map(normalizeLegacyTrainingExercise),
      error: null,
    } as { data: TrainingSessionExercise[]; error: null };
  },
  async getLogs(sessionIds: string[]) {
    if (!sessionIds.length) return { data: [], error: null } as { data: TrainingLog[]; error: null };
    return db.from("training_logs").select("*").in("training_session_id", sessionIds).order("performed_at", { ascending: false }) as Promise<{ data: TrainingLog[] | null; error: { message: string } | null }>;
  },
  async getExerciseLogs(logIds: string[]) {
    if (!logIds.length) return { data: [], error: null } as { data: TrainingExerciseLog[]; error: null };
    return db.from("training_exercise_logs").select("*").in("training_log_id", logIds).order("set_number", { ascending: true }) as Promise<{ data: TrainingExerciseLog[] | null; error: { message: string } | null }>;
  },
  async getMeasurements() {
    return db
      .from("athlete_measurements")
      .select("*")
      .order("measurement_date", { ascending: false })
      .order("updated_at", { ascending: false }) as Promise<{ data: AthleteMeasurement[] | null; error: { message: string } | null }>;
  },
  async getMentalPrompts() {
    return db.from("mental_game_prompts").select("*").order("position") as Promise<{ data: MentalGamePrompt[] | null; error: { message: string } | null }>;
  },
  async getMentalEntries() {
    return db.from("mental_game_entries").select("*").order("entry_date", { ascending: false }) as Promise<{ data: MentalGameEntry[] | null; error: { message: string } | null }>;
  },
  async bootstrapProgram({
    userId,
    age,
    weightKg,
    heightCm,
    trainingBackground,
    now,
  }: {
    userId: string;
    age: number;
    weightKg: number;
    heightCm: number | null;
    trainingBackground: string;
    now: Date;
  }) {
    const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 6=Sab
    const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + daysUntilMonday);
    const startDate = monday.toISOString().slice(0, 10);
    const profilePayload = {
      user_id: userId,
      age,
      weight_kg: weightKg,
      height_cm: heightCm,
      training_background: trainingBackground.trim() || null,
      primary_goal: "performance_recomp",
      restrictions: null,
      gym_window_start: "07:00",
      gym_window_end: "08:20",
      beach_tennis_days: ["monday", "tuesday", "wednesday", "sunday"],
      protein_target_g_per_kg: 1.8,
      program_start_date: startDate,
      mental_rotation_started_on: startDate,
    };

    const profileResult = await db.from("athlete_profiles").upsert(profilePayload, { onConflict: "user_id" }).select("*").single() as { data: AthleteProfile | null; error: { message: string } | null };
    if (profileResult.error || !profileResult.data) return profileResult;

    const plan = buildTrainingPlan({
      athleteProfile: {
        user_id: userId,
        primary_goal: "performance_recomp",
        program_start_date: startDate,
      },
      now,
    });

    const programResult = await db.from("training_programs").insert(plan.program).select("*").single() as { data: TrainingProgram | null; error: { message: string } | null };
    const createdProgram = programResult.data;
    if (programResult.error || !createdProgram) return { data: null, error: programResult.error };

    const blocksResult = await db.from("training_blocks").insert(plan.blocks.map((block) => ({
      ...block,
      training_program_id: createdProgram.id,
    }))).select("*") as { data: TrainingBlock[] | null; error: { message: string } | null };
    const createdBlocks = blocksResult.data;
    if (blocksResult.error || !createdBlocks) return { data: null, error: blocksResult.error };

    const blockMap = new Map(createdBlocks.map((block) => [block.block_index, block.id]));
    const sessionsResult = await db.from("training_sessions").insert(plan.sessions.map(({ block_index, ...session }) => ({
      ...session,
      training_program_id: createdProgram.id,
      training_block_id: blockMap.get(block_index) || null,
    }))).select("*") as { data: TrainingSession[] | null; error: { message: string } | null };
    const createdSessions = sessionsResult.data;
    if (sessionsResult.error || !createdSessions) return { data: null, error: sessionsResult.error };

    const sessionMap = new Map(createdSessions.map((session) => [session.builder_key, session.id]));
    const exercisesResult = await db.from("training_session_exercises").insert(plan.sessionExercises.map((exercise) => ({
      user_id: exercise.user_id,
      training_session_id: sessionMap.get(exercise.session_builder_key),
      prescribed_order: exercise.prescribed_order,
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
    }))).select("*") as { data: TrainingSessionExercise[] | null; error: { message: string } | null };
    if (exercisesResult.error) return { data: null, error: exercisesResult.error };

    await db.from("athlete_measurements").upsert({
      user_id: userId,
      measurement_date: startDate,
      weight_kg: weightKg,
      notes_md: "Checkpoint inicial criado no onboarding do modulo Treino.",
    }, { onConflict: "user_id,measurement_date" });

    return { data: { profile: profileResult.data, program: programResult.data }, error: null };
  },
  async saveTrainingLog({
    userId,
    sessionId,
    logPayload,
    exerciseLogs,
  }: {
    userId: string;
    sessionId: string;
    logPayload: {
      duration_minutes: number;
      session_rpe: number | null;
      body_weight_kg: number | null;
      sleep_hours: number | null;
      readiness_score: number | null;
      fatigue_score: number | null;
      notes_md: string | null;
    };
    exerciseLogs: Array<{
      training_session_exercise_id: string;
      set_number: number;
      reps_completed: number | null;
      load_kg: number | null;
      rpe: number | null;
      duration_seconds: number | null;
      distance_meters: number | null;
      completed: boolean;
      notes: string | null;
    }>;
  }) {
    const logResult = await db
      .from("training_logs")
      .upsert(
        {
          user_id: userId,
          training_session_id: sessionId,
          performed_at: new Date().toISOString(),
          ...logPayload,
        },
        { onConflict: "user_id,training_session_id" },
      )
      .select("*")
      .single() as { data: TrainingLog | null; error: { message: string } | null };

    if (logResult.error || !logResult.data) return logResult;

    await db.from("training_exercise_logs").delete().eq("training_log_id", logResult.data.id);

    if (exerciseLogs.length > 0) {
      const saveExerciseLogs = await db.from("training_exercise_logs").insert(exerciseLogs.map((row) => ({
        user_id: userId,
        training_log_id: logResult.data!.id,
        ...row,
      }))).select("*");

      if (saveExerciseLogs.error) {
        return { data: null, error: saveExerciseLogs.error };
      }
    }

    return logResult;
  },
  async deleteTrainingLog({
    userId,
    sessionId,
  }: {
    userId: string;
    sessionId: string;
  }) {
    return db
      .from("training_logs")
      .delete()
      .eq("user_id", userId)
      .eq("training_session_id", sessionId) as Promise<{ data: TrainingLog[] | null; error: { message: string } | null }>;
  },
  async saveMentalEntry({
    userId,
    entryDate,
    promptId,
    applied,
  }: {
    userId: string;
    entryDate: string;
    promptId: string;
    applied: boolean;
  }) {
    return db
      .from("mental_game_entries")
      .upsert(
        {
          user_id: userId,
          entry_date: entryDate,
          prompt_id: promptId,
          applied,
        },
        { onConflict: "user_id,entry_date" },
      )
      .select("*")
      .single() as Promise<{ data: MentalGameEntry | null; error: { message: string } | null }>;
  },
  async saveMeasurement({
    userId,
    measurementDate,
    weightKg,
    waistCm,
    notesMd,
  }: {
    userId: string;
    measurementDate: string;
    weightKg: number | null;
    waistCm: number | null;
    notesMd: string | null;
  }) {
    return db
      .from("athlete_measurements")
      .upsert({
        user_id: userId,
        measurement_date: measurementDate,
        weight_kg: weightKg,
        waist_cm: waistCm,
        notes_md: notesMd,
      }, { onConflict: "user_id,measurement_date" })
      .select("*")
      .single() as Promise<{ data: AthleteMeasurement | null; error: { message: string } | null }>;
  },
  async deleteMeasurement({
    userId,
    measurementId,
  }: {
    userId: string;
    measurementId: string;
  }) {
    return db
      .from("athlete_measurements")
      .delete()
      .eq("user_id", userId)
      .eq("id", measurementId) as Promise<{ data: AthleteMeasurement[] | null; error: { message: string } | null }>;
  },
};
