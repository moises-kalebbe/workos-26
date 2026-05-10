import { describe, expect, it } from "vitest";
import {
  buildTrainingPlan,
  getMentalGameDayOffset,
  recommendLoadProgression,
  selectMentalGamePrompt,
} from "@/lib/trainingPlan";

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

describe("training plan builder", () => {
  it("generates 24 weeks with 5 morning gym sessions (Mon/Tue/Wed/Fri/Sat) and no embedded beach tennis sessions", () => {
    const plan = buildTrainingPlan({
      athleteProfile: ATHLETE_PROFILE,
      now: new Date("2026-04-10T12:00:00.000Z"),
    });

    expect(plan.blocks).toHaveLength(6);
    expect(new Set(plan.sessions.map((session) => session.week_number)).size).toBe(24);
    expect(plan.sessions).toHaveLength(24 * 5);

    const trainingDays = new Set(["monday", "tuesday", "wednesday", "friday", "saturday"]);

    for (let week = 1; week <= 24; week += 1) {
      const weekSessions = plan.sessions.filter((session) => session.week_number === week);
      expect(weekSessions).toHaveLength(5);
      for (const session of weekSessions) {
        expect(session.time_slot).toBe("morning");
        expect(trainingDays.has(session.day_of_week)).toBe(true);
        expect(session.session_type).not.toBe("beach_tennis");
      }
    }
  });

  it("marks weeks 4, 8, 12, 16, 20 and 24 as deload weeks with reduced lower-body volume", () => {
    const plan = buildTrainingPlan({
      athleteProfile: ATHLETE_PROFILE,
      now: new Date("2026-04-10T12:00:00.000Z"),
    });

    const week3Lower = plan.sessions.find(
      (session) => session.week_number === 3 && session.day_of_week === "monday" && session.time_slot === "morning",
    );
    const week4Lower = plan.sessions.find(
      (session) => session.week_number === 4 && session.day_of_week === "monday" && session.time_slot === "morning",
    );

    expect(week3Lower).toBeDefined();
    expect(week4Lower?.is_deload_week).toBe(true);

    const week3SetCount = plan.sessionExercises
      .filter((exercise) => exercise.session_builder_key === week3Lower?.builder_key)
      .reduce((total, exercise) => total + exercise.prescribed_sets, 0);
    const week4SetCount = plan.sessionExercises
      .filter((exercise) => exercise.session_builder_key === week4Lower?.builder_key)
      .reduce((total, exercise) => total + exercise.prescribed_sets, 0);

    expect(week4SetCount).toBeLessThan(week3SetCount);
  });

  it("places gym-friendly power and conditioning exercises in the Tuesday push and Wednesday sprint sessions", () => {
    const plan = buildTrainingPlan({
      athleteProfile: ATHLETE_PROFILE,
      now: new Date("2026-04-10T12:00:00.000Z"),
    });

    const tuesdaySession = plan.sessions.find(
      (session) => session.week_number === 1 && session.day_of_week === "tuesday" && session.time_slot === "morning",
    );
    const wednesdaySession = plan.sessions.find(
      (session) => session.week_number === 1 && session.day_of_week === "wednesday" && session.time_slot === "morning",
    );

    const tuesdayExercises = plan.sessionExercises
      .filter((exercise) => exercise.session_builder_key === tuesdaySession?.builder_key)
      .map((exercise) => exercise.exercise_name);
    const wednesdayExercises = plan.sessionExercises
      .filter((exercise) => exercise.session_builder_key === wednesdaySession?.builder_key)
      .map((exercise) => exercise.exercise_name);

    expect(tuesdayExercises).toContain("Jump shrug com barra");
    expect(tuesdayExercises).toContain("Rotacao explosiva no cabo");
    expect(wednesdayExercises).toContain("Bike sprint estendido");

    const allNames = plan.sessionExercises.map((exercise) => exercise.exercise_name);
    expect(allNames).not.toContain("Medicine ball scoop toss");
    expect(allNames).not.toContain("Rotational shot put throw");
    expect(allNames).not.toContain("Shuttle curto");
  });

  it("does not advance the mental prompt before local midnight even if UTC already changed", () => {
    const prompts = [
      { id: "prompt_1", position: 1, title: "Respira", cue: "respira", application_hint: "solta o ar", category: "breathing", evidence_tag: "pst" },
      { id: "prompt_2", position: 2, title: "Reset", cue: "reseta", application_hint: "proxima bola", category: "reset", evidence_tag: "pst" },
      { id: "prompt_3", position: 3, title: "Parceiro", cue: "fala", application_hint: "comunica", category: "partnership", evidence_tag: "pst" },
    ];

    const offset = getMentalGameDayOffset({
      rotationStartedOn: "2026-04-13",
      now: new Date("2026-04-14T01:30:00.000Z"),
      timezone: "America/Sao_Paulo",
    });
    const prompt = selectMentalGamePrompt({
      prompts,
      rotationStartedOn: "2026-04-13",
      now: new Date("2026-04-14T01:30:00.000Z"),
      timezone: "America/Sao_Paulo",
    });

    expect(offset).toBe(0);
    expect(prompt?.id).toBe("prompt_1");
  });

  it("recommends increasing the load when every set hits the top of the range within the target RPE", () => {
    const recommendation = recommendLoadProgression({
      target_rep_min: 4,
      target_rep_max: 6,
      target_rpe: 8,
      reps_completed: [6, 6, 6, 6],
      set_rpe: [7, 7.5, 7.5, 8],
      load_increment_lower_kg: 5,
      load_increment_upper_kg: 2,
      emphasis: "lower",
      readiness_score: 4,
      sleep_hours: 7.5,
      previous_beach_tennis_rpe: 5,
    });

    expect(recommendation.action).toBe("increase");
    expect(recommendation.recommended_load_increment_kg).toBe(5);
  });

  it("recommends cutting one main set and the finisher when readiness or recovery is poor", () => {
    const recommendation = recommendLoadProgression({
      target_rep_min: 6,
      target_rep_max: 8,
      target_rpe: 8,
      reps_completed: [8, 8, 7],
      set_rpe: [8, 8.5, 9],
      load_increment_lower_kg: 5,
      load_increment_upper_kg: 2,
      emphasis: "upper",
      readiness_score: 2,
      sleep_hours: 5.5,
      previous_beach_tennis_rpe: 8,
    });

    expect(recommendation.action).toBe("reduce_volume");
    expect(recommendation.remove_main_sets).toBe(1);
    expect(recommendation.skip_finisher).toBe(true);
  });
});
