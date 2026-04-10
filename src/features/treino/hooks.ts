import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { treinoApi } from "@/features/treino/api";
import type {
  TreinoChartPoint,
  TreinoMeasurement,
  TreinoMentalEntry,
  TreinoMentalPrompt,
  TreinoOnboardingInput,
  TreinoProfile,
  TreinoSessionDraft,
  TreinoSessionExercise,
  TreinoSessionWithContext,
  TreinoSetDraft,
} from "@/features/treino/types";
import { selectMentalGamePrompt } from "@/lib/trainingPlan";

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeList<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function dateKeyFromIso(value: string) {
  return value.slice(0, 10);
}

function toDateKey(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function getTodayKey(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function estimateE1RM(loadKg: number, reps: number) {
  return loadKg * (1 + reps / 30);
}

export function createTrainingSessionDraft(session: TreinoSessionWithContext | null): TreinoSessionDraft {
  if (!session) {
    return {
      durationMinutes: "",
      sessionRpe: "",
      bodyWeightKg: "",
      sleepHours: "",
      readinessScore: "",
      fatigueScore: "",
      notesMd: "",
      exerciseSets: {},
    };
  }

  const exerciseSets = Object.fromEntries(
    session.exercises.map((exercise) => {
      const existing = session.exerciseLogs
        .filter((log) => log.training_session_exercise_id === exercise.id)
        .sort((left, right) => left.set_number - right.set_number);

      const rows: TreinoSetDraft[] = Array.from({ length: exercise.prescribed_sets }, (_, index) => {
        const current = existing[index];
        return {
          setNumber: index + 1,
          repsCompleted: current?.reps_completed ? String(current.reps_completed) : "",
          loadKg: current?.load_kg ? String(current.load_kg) : "",
          rpe: current?.rpe ? String(current.rpe) : "",
          durationSeconds: current?.duration_seconds ? String(current.duration_seconds) : "",
          distanceMeters: current?.distance_meters ? String(current.distance_meters) : "",
          completed: current?.completed ?? false,
          notes: current?.notes || "",
        };
      });

      return [exercise.id, rows];
    }),
  );

  return {
    durationMinutes: session.log?.duration_minutes ? String(session.log.duration_minutes) : String(session.target_duration_minutes),
    sessionRpe: session.log?.session_rpe ? String(session.log.session_rpe) : session.target_rpe ? String(session.target_rpe) : "",
    bodyWeightKg: session.log?.body_weight_kg ? String(session.log.body_weight_kg) : "",
    sleepHours: session.log?.sleep_hours ? String(session.log.sleep_hours) : "",
    readinessScore: session.log?.readiness_score ? String(session.log.readiness_score) : "",
    fatigueScore: session.log?.fatigue_score ? String(session.log.fatigue_score) : "",
    notesMd: session.log?.notes_md || "",
    exerciseSets,
  };
}

export function useTreinoFeature({ userId }: { userId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [profile, setProfile] = useState<TreinoProfile | null>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionExercises, setSessionExercises] = useState<TreinoSessionExercise[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<TreinoMeasurement[]>([]);
  const [mentalPrompts, setMentalPrompts] = useState<TreinoMentalPrompt[]>([]);
  const [mentalEntries, setMentalEntries] = useState<TreinoMentalEntry[]>([]);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setPrograms([]);
      setBlocks([]);
      setSessions([]);
      setSessionExercises([]);
      setLogs([]);
      setExerciseLogs([]);
      setMeasurements([]);
      setMentalPrompts([]);
      setMentalEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timezoneRes = await treinoApi.getTimezone();
      setTimezone((timezoneRes.data as { timezone?: string } | null)?.timezone || "America/Sao_Paulo");

      const [profileRes, programsRes, measurementsRes, promptsRes, mentalEntriesRes] = await Promise.all([
        treinoApi.getProfile(),
        treinoApi.getPrograms(),
        treinoApi.getMeasurements(),
        treinoApi.getMentalPrompts(),
        treinoApi.getMentalEntries(),
      ]);

      if (profileRes.error) throw new Error(profileRes.error.message);
      if (programsRes.error) throw new Error(programsRes.error.message);
      if (measurementsRes.error) throw new Error(measurementsRes.error.message);
      if (promptsRes.error) throw new Error(promptsRes.error.message);
      if (mentalEntriesRes.error) throw new Error(mentalEntriesRes.error.message);

      const nextPrograms = normalizeList(programsRes.data);
      const activeProgram = nextPrograms.find((program) => program.status === "active") || nextPrograms[0] || null;

      setProfile(profileRes.data ? ({
        ...profileRes.data,
        age: integerOrNull(profileRes.data.age) || 0,
        weight_kg: numberOrNull(profileRes.data.weight_kg) || 0,
        height_cm: numberOrNull(profileRes.data.height_cm),
        protein_target_g_per_kg: numberOrNull(profileRes.data.protein_target_g_per_kg) || 1.8,
        program_start_date: toDateKey(profileRes.data.program_start_date),
        mental_rotation_started_on: toDateKey(profileRes.data.mental_rotation_started_on),
      }) : null);
      setPrograms(nextPrograms);
      setMeasurements(normalizeList(measurementsRes.data).map((row) => ({
        ...row,
        measurement_date: toDateKey(row.measurement_date),
        weight_kg: numberOrNull(row.weight_kg),
        waist_cm: numberOrNull(row.waist_cm),
      })));
      setMentalPrompts(normalizeList(promptsRes.data).map((prompt) => ({ ...prompt, position: integerOrNull(prompt.position) || 0 })));
      setMentalEntries(normalizeList(mentalEntriesRes.data).map((entry) => ({
        ...entry,
        entry_date: toDateKey(entry.entry_date),
      })));

      if (!activeProgram) {
        setBlocks([]);
        setSessions([]);
        setSessionExercises([]);
        setLogs([]);
        setExerciseLogs([]);
        return;
      }

      const [blocksRes, sessionsRes] = await Promise.all([
        treinoApi.getBlocks(activeProgram.id),
        treinoApi.getSessions(activeProgram.id),
      ]);

      if (blocksRes.error) throw new Error(blocksRes.error.message);
      if (sessionsRes.error) throw new Error(sessionsRes.error.message);

      const nextSessions = normalizeList(sessionsRes.data).map((session) => ({
        ...session,
        session_date: toDateKey(session.session_date),
        week_number: integerOrNull(session.week_number) || 0,
        target_duration_minutes: integerOrNull(session.target_duration_minutes) || 0,
        target_rpe: numberOrNull(session.target_rpe),
      }));

      setBlocks(normalizeList(blocksRes.data).map((block) => ({
        ...block,
        block_index: integerOrNull(block.block_index) || 0,
        week_start: integerOrNull(block.week_start) || 0,
        week_end: integerOrNull(block.week_end) || 0,
      })));
      setSessions(nextSessions);

      const sessionIds = nextSessions.map((session) => session.id);
      const exercisesRes = await treinoApi.getSessionExercises(sessionIds);
      if (exercisesRes.error) throw new Error(exercisesRes.error.message);

      const normalizedExercises = normalizeList(exercisesRes.data).map((exercise) => ({
        ...exercise,
        prescribed_order: integerOrNull(exercise.prescribed_order) || 0,
        prescribed_sets: integerOrNull(exercise.prescribed_sets) || 0,
        target_rep_min: integerOrNull(exercise.target_rep_min),
        target_rep_max: integerOrNull(exercise.target_rep_max),
        rest_seconds: integerOrNull(exercise.rest_seconds),
        target_rpe: numberOrNull(exercise.target_rpe),
        target_rir: numberOrNull(exercise.target_rir),
      }));
      setSessionExercises(normalizedExercises);

      const logsRes = await treinoApi.getLogs(sessionIds);
      if (logsRes.error) throw new Error(logsRes.error.message);

      const normalizedLogs = normalizeList(logsRes.data).map((log) => ({
        ...log,
        duration_minutes: integerOrNull(log.duration_minutes) || 0,
        session_rpe: integerOrNull(log.session_rpe),
        session_load: numberOrNull(log.session_load) || 0,
        body_weight_kg: numberOrNull(log.body_weight_kg),
        sleep_hours: numberOrNull(log.sleep_hours),
      }));
      setLogs(normalizedLogs);

      const exerciseLogsRes = await treinoApi.getExerciseLogs(normalizedLogs.map((log) => log.id));
      if (exerciseLogsRes.error) throw new Error(exerciseLogsRes.error.message);

      setExerciseLogs(normalizeList(exerciseLogsRes.data).map((log) => ({
        ...log,
        set_number: integerOrNull(log.set_number) || 0,
        reps_completed: integerOrNull(log.reps_completed),
        load_kg: numberOrNull(log.load_kg),
        rpe: numberOrNull(log.rpe),
        duration_seconds: integerOrNull(log.duration_seconds),
        distance_meters: numberOrNull(log.distance_meters),
      })));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao carregar o modulo de treino.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeProgram = programs.find((program) => program.status === "active") || programs[0] || null;
  const todayKey = getTodayKey(timezone);

  const sessionsWithContext = useMemo<TreinoSessionWithContext[]>(() => {
    const blockMap = new Map(blocks.map((block) => [block.id, block]));
    const exercisesBySession = new Map<string, TreinoSessionExercise[]>();
    sessionExercises.forEach((exercise) => {
      const current = exercisesBySession.get(exercise.training_session_id) || [];
      current.push(exercise);
      exercisesBySession.set(exercise.training_session_id, current);
    });
    const logBySession = new Map(logs.map((log) => [log.training_session_id, log]));
    const exerciseLogsByLog = new Map<string, any[]>();
    exerciseLogs.forEach((log) => {
      const current = exerciseLogsByLog.get(log.training_log_id) || [];
      current.push(log);
      exerciseLogsByLog.set(log.training_log_id, current);
    });

    return sessions.map((session) => {
      const currentLog = logBySession.get(session.id) || null;
      return {
        ...session,
        block: session.training_block_id ? blockMap.get(session.training_block_id) || null : null,
        exercises: (exercisesBySession.get(session.id) || []).sort((left, right) => left.prescribed_order - right.prescribed_order),
        log: currentLog,
        exerciseLogs: currentLog ? exerciseLogsByLog.get(currentLog.id) || [] : [],
      };
    });
  }, [blocks, exerciseLogs, logs, sessionExercises, sessions]);

  const currentWeekNumber = useMemo(() => {
    if (!profile?.program_start_date) return 1;
    const diff = Math.floor((new Date(`${todayKey}T00:00:00.000Z`).getTime() - new Date(`${profile.program_start_date}T00:00:00.000Z`).getTime()) / 86400000);
    return Math.min(24, Math.max(1, Math.floor(diff / 7) + 1));
  }, [profile?.program_start_date, todayKey]);

  const currentWeekSessions = useMemo(
    () => sessionsWithContext.filter((session) => session.week_number === currentWeekNumber),
    [currentWeekNumber, sessionsWithContext],
  );

  const todaySession = useMemo(
    () => sessionsWithContext.find((session) => session.session_date === todayKey) || sessionsWithContext.find((session) => session.session_date >= todayKey) || null,
    [sessionsWithContext, todayKey],
  );

  const todayMentalPrompt = useMemo(
    () => profile ? selectMentalGamePrompt({
      prompts: mentalPrompts,
      rotationStartedOn: profile.mental_rotation_started_on,
      now: new Date(),
      timezone,
    }) : null,
    [mentalPrompts, profile, timezone],
  );

  const todayMentalEntry = useMemo(
    () => mentalEntries.find((entry) => entry.entry_date === todayKey) || null,
    [mentalEntries, todayKey],
  );

  const chartPoints = useMemo<TreinoChartPoint[]>(() => {
    const sessionMap = new Map(sessionsWithContext.map((session) => [session.id, session]));
    const exerciseMap = new Map(sessionExercises.map((exercise) => [exercise.id, exercise]));
    const byDate = new Map<string, TreinoChartPoint>();

    logs.forEach((log) => {
      const session = sessionMap.get(log.training_session_id);
      const dateKey = session?.session_date || dateKeyFromIso(log.performed_at);
      const current = byDate.get(dateKey) || { label: dateKey.slice(5), sessionLoad: 0, e1rm: 0, bodyWeight: 0, sleepHours: 0 };
      current.sessionLoad += log.session_load || 0;
      current.bodyWeight = log.body_weight_kg || current.bodyWeight;
      current.sleepHours = log.sleep_hours || current.sleepHours;

      exerciseLogs
        .filter((item) => item.training_log_id === log.id && item.load_kg && item.reps_completed)
        .forEach((item) => {
          const exercise = exerciseMap.get(item.training_session_exercise_id);
          if (exercise?.category !== "main" || !item.load_kg || !item.reps_completed) return;
          current.e1rm = Math.max(current.e1rm, estimateE1RM(item.load_kg, item.reps_completed));
        });

      byDate.set(dateKey, current);
    });

    measurements.forEach((measurement) => {
      const dateKey = measurement.measurement_date;
      const current = byDate.get(dateKey) || { label: dateKey.slice(5), sessionLoad: 0, e1rm: 0, bodyWeight: 0, sleepHours: 0 };
      current.bodyWeight = measurement.weight_kg || current.bodyWeight;
      byDate.set(dateKey, current);
    });

    return [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-8)
      .map(([, value]) => value);
  }, [exerciseLogs, logs, measurements, sessionExercises, sessionsWithContext]);

  const bootstrapProgram = useCallback(async (input: TreinoOnboardingInput) => {
    if (!userId) return;
    setBootstrapping(true);
    try {
      const response = await treinoApi.bootstrapProgram({
        userId,
        age: integerOrNull(input.age) || 37,
        weightKg: numberOrNull(input.weightKg) || 104,
        heightCm: numberOrNull(input.heightCm),
        trainingBackground: input.trainingBackground,
        now: new Date(),
      });
      if (response.error) throw new Error(response.error.message);
      toast.success("Modulo Treino inicializado.");
      await refresh();
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Falha ao criar o programa de treino.");
    } finally {
      setBootstrapping(false);
    }
  }, [refresh, userId]);

  const saveSessionLog = useCallback(async (session: TreinoSessionWithContext | null, draft: TreinoSessionDraft) => {
    if (!userId || !session) return;
    setSaving(true);
    try {
      const exerciseRows = session.exercises.flatMap((exercise) =>
        (draft.exerciseSets[exercise.id] || [])
          .filter((row) => row.completed || row.repsCompleted || row.loadKg || row.durationSeconds || row.distanceMeters)
          .map((row) => ({
            training_session_exercise_id: exercise.id,
            set_number: row.setNumber,
            reps_completed: integerOrNull(row.repsCompleted),
            load_kg: numberOrNull(row.loadKg),
            rpe: numberOrNull(row.rpe),
            duration_seconds: integerOrNull(row.durationSeconds),
            distance_meters: numberOrNull(row.distanceMeters),
            completed: row.completed,
            notes: row.notes.trim() || null,
          })),
      );

      const response = await treinoApi.saveTrainingLog({
        userId,
        sessionId: session.id,
        logPayload: {
          duration_minutes: integerOrNull(draft.durationMinutes) || session.target_duration_minutes,
          session_rpe: integerOrNull(draft.sessionRpe),
          body_weight_kg: numberOrNull(draft.bodyWeightKg),
          sleep_hours: numberOrNull(draft.sleepHours),
          readiness_score: integerOrNull(draft.readinessScore),
          fatigue_score: integerOrNull(draft.fatigueScore),
          notes_md: draft.notesMd.trim() || null,
        },
        exerciseLogs: exerciseRows,
      });

      if (response.error) throw new Error(response.error.message);
      toast.success("Sessao salva.");
      await refresh();
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Falha ao salvar a sessao.");
    } finally {
      setSaving(false);
    }
  }, [refresh, userId]);

  const toggleMentalApplied = useCallback(async (applied: boolean) => {
    if (!userId || !todayMentalPrompt) return;
    try {
      const response = await treinoApi.saveMentalEntry({
        userId,
        entryDate: todayKey,
        promptId: todayMentalPrompt.id,
        applied,
      });
      if (response.error) throw new Error(response.error.message);
      toast.success("Checklist mental atualizado.");
      await refresh();
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Falha ao salvar a rotina mental.");
    }
  }, [refresh, todayKey, todayMentalPrompt, userId]);

  const saveMeasurement = useCallback(async ({ weightKg, waistCm, notesMd }: { weightKg: string; waistCm: string; notesMd: string }) => {
    if (!userId) return;
    try {
      const response = await treinoApi.saveMeasurement({
        userId,
        measurementDate: todayKey,
        weightKg: numberOrNull(weightKg),
        waistCm: numberOrNull(waistCm),
        notesMd: notesMd.trim() || null,
      });
      if (response.error) throw new Error(response.error.message);
      toast.success("Checkpoint salvo.");
      await refresh();
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : "Falha ao salvar checkpoint.");
    }
  }, [refresh, todayKey, userId]);

  return {
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
    saveMeasurement,
    saveSessionLog,
    saving,
    sessionsWithContext,
    timezone,
    todayKey,
    todayMentalEntry,
    todayMentalPrompt,
    todaySession,
    toggleMentalApplied,
  };
}
