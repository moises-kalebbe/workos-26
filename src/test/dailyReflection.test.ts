import { describe, expect, it } from "vitest";
import {
  getDailyReflectionDayOffset,
  normalizeDailyReflectionPrompt,
  selectDailyReflectionPrompt,
  type DailyReflectionPromptLike,
} from "@/lib/dailyReflection";

const PROMPTS: DailyReflectionPromptLike[] = [
  { id: "prompt_1", position: 1, title: "Foco" },
  { id: "prompt_2", position: 2, title: "Eliminacao" },
  { id: "prompt_3", position: 3, title: "Rotina" },
];

describe("dailyReflection helpers", () => {
  it("returns day offset 0 on the rotation start date", () => {
    const offset = getDailyReflectionDayOffset({
      rotationStartedOn: "2026-04-07",
      now: new Date("2026-04-07T15:00:00.000Z"),
      timezone: "America/Sao_Paulo",
    });

    expect(offset).toBe(0);
  });

  it("does not advance the prompt before local midnight even if UTC already changed", () => {
    const prompt = selectDailyReflectionPrompt({
      prompts: PROMPTS,
      rotationStartedOn: "2026-04-07",
      now: new Date("2026-04-08T01:30:00.000Z"),
      timezone: "America/Sao_Paulo",
    });

    expect(prompt?.id).toBe("prompt_1");
  });

  it("advances one prompt after the local date changes", () => {
    const prompt = selectDailyReflectionPrompt({
      prompts: PROMPTS,
      rotationStartedOn: "2026-04-07",
      now: new Date("2026-04-08T03:30:00.000Z"),
      timezone: "America/Sao_Paulo",
    });

    expect(prompt?.id).toBe("prompt_2");
  });

  it("loops back to the first prompt after reaching the end of the list", () => {
    const prompt = selectDailyReflectionPrompt({
      prompts: PROMPTS,
      rotationStartedOn: "2026-04-07",
      now: new Date("2026-04-10T12:00:00.000Z"),
      timezone: "America/Sao_Paulo",
    });

    expect(prompt?.id).toBe("prompt_1");
  });

  it("normalizes prompt score and position when Postgres returns numeric fields as strings", () => {
    const normalized = normalizeDailyReflectionPrompt({
      id: "prompt_10",
      position: "10",
      title: "Dormir melhor",
      score: "9.6",
      summary: "Energia ruim destrói foco.",
      application_hint: "Durma melhor.",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    });

    expect(normalized.position).toBe(10);
    expect(normalized.score).toBe(9.6);
  });
});
