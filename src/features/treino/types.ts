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

export type TreinoProfile = AthleteProfile;
export type TreinoProgram = TrainingProgram;
export type TreinoBlock = TrainingBlock;
export type TreinoSession = TrainingSession;
export type TreinoSessionExercise = TrainingSessionExercise;
export type TreinoLog = TrainingLog;
export type TreinoExerciseLog = TrainingExerciseLog;
export type TreinoMeasurement = AthleteMeasurement;
export type TreinoMentalPrompt = MentalGamePrompt;
export type TreinoMentalEntry = MentalGameEntry;

export type TreinoOnboardingInput = {
  age: string;
  weightKg: string;
  heightCm: string;
  trainingBackground: string;
};

export type TreinoSetDraft = {
  setNumber: number;
  repsCompleted: string;
  loadKg: string;
  rpe: string;
  durationSeconds: string;
  distanceMeters: string;
  completed: boolean;
  notes: string;
};

export type TreinoSessionDraft = {
  durationMinutes: string;
  sessionRpe: string;
  bodyWeightKg: string;
  sleepHours: string;
  readinessScore: string;
  fatigueScore: string;
  notesMd: string;
  exerciseSets: Record<string, TreinoSetDraft[]>;
};

export type TreinoSessionWithContext = TreinoSession & {
  block: TreinoBlock | null;
  exercises: TreinoSessionExercise[];
  log: TreinoLog | null;
  exerciseLogs: TreinoExerciseLog[];
};

export type TreinoChartPoint = {
  label: string;
  sessionLoad: number;
  e1rm: number;
  bodyWeight: number;
  sleepHours: number;
};
