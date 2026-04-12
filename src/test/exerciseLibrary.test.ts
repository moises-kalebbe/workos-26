import { describe, expect, it } from "vitest";
import { getExerciseInfo } from "@/lib/exerciseLibrary";
import { buildTrainingPlan } from "@/lib/trainingPlan";

const ATHLETE_PROFILE = {
  user_id: "user_123",
  age: 37,
  weight_kg: 104,
  height_cm: 185,
  training_background: "Treinou quase direto por 10 anos, retornando agora.",
  primary_goal: "performance_recomp",
  restrictions: null,
  gym_window_start: "07:00",
  gym_window_end: "08:20",
  beach_tennis_days: ["monday", "tuesday", "wednesday", "sunday"],
  protein_target_g_per_kg: 1.8,
  program_start_date: "2026-04-13",
  mental_rotation_started_on: "2026-04-13",
  created_at: "2026-04-10T12:00:00.000Z",
  updated_at: "2026-04-10T12:00:00.000Z",
} as const;

describe("exercise library", () => {
  it("resolves canonical and aliased exercise names", () => {
    expect(getExerciseInfo("Rotacao externa com cabo")).not.toBeNull();
    expect(getExerciseInfo("Rotação externa com cabo")).not.toBeNull();
    expect(getExerciseInfo("Pronacao e supinacao de antebraco")).not.toBeNull();
    expect(getExerciseInfo("Pronação e supinação de antebraço")).not.toBeNull();
    expect(getExerciseInfo("Mobilidade quadril, tornozelo e toracica")).not.toBeNull();
    expect(getExerciseInfo("Mobilidade quadril, tornozelo e torácica")).not.toBeNull();
    expect(getExerciseInfo("RDL")).not.toBeNull();
  });

  it("covers every exercise emitted by the training plan with description and video metadata", () => {
    const plan = buildTrainingPlan({
      athleteProfile: ATHLETE_PROFILE,
      now: new Date("2026-04-10T12:00:00.000Z"),
    });

    const exerciseNames = [...new Set(plan.sessionExercises.map((exercise) => exercise.exercise_name))];
    const unresolved = exerciseNames.filter((exerciseName) => !getExerciseInfo(exerciseName));

    expect(unresolved).toEqual([]);

    for (const exerciseName of exerciseNames) {
      const info = getExerciseInfo(exerciseName);
      expect(info?.description.trim().length, `${exerciseName} should have a description`).toBeGreaterThan(0);
      expect(info?.youtubeSearch.startsWith("https://www.youtube.com/results?search_query="), `${exerciseName} should have a YouTube search link`).toBe(true);
    }
  });
});
