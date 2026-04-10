import { describe, expect, it } from "vitest";
import {
  buildDailyReflectionChecklist,
  getDailyReflectionChecklist,
  getDailyReflectionDayOffset,
  normalizeDailyReflectionEntry,
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
      summary: "Energia ruim destroi foco.",
      application_hint: "Durma melhor.",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    });

    expect(normalized.position).toBe(10);
    expect(normalized.score).toBe(9.6);
  });

  it("builds an actionable checklist from the prompt", () => {
    const checklist = buildDailyReflectionChecklist({
      id: "prompt_20",
      title: "Delegacao",
      application_hint: "Delegue uma decisao repetitiva hoje",
    });

    expect(checklist).toHaveLength(3);
    expect(checklist[0]).toMatchObject({
      id: "prompt_20:context",
      completed: false,
    });
    expect(checklist[1]?.title).toContain("Delegue uma decisao repetitiva hoje.");
  });

  it("reuses stored checklist entries when they already exist", () => {
    const checklist = getDailyReflectionChecklist({
      prompt: {
        id: "prompt_21",
        title: "Energia",
        application_hint: "Proteja seu bloco mais importante.",
      },
      storedChecklist: [
        {
          id: "saved:1",
          title: "Fechei uma decisao antes do almoco",
          completed: true,
        },
      ],
    });

    expect(checklist).toEqual([
      {
        id: "saved:1",
        title: "Fechei uma decisao antes do almoco",
        completed: true,
      },
    ]);
  });

  it("normalizes checklist JSON and tomorrow focus from entry records", () => {
    const entry = normalizeDailyReflectionEntry({
      id: "entry_1",
      user_id: "user_1",
      entry_date: "2026-04-10",
      prompt_id: "prompt_1",
      checklist_json: [
        {
          id: "a",
          title: "  Fechar proposta principal  ",
          completed: true,
        },
        {
          id: "invalid",
          title: "",
          completed: false,
        },
      ],
      actions_taken_md: "Fechei a proposta e registrei os proximos passos.",
      tomorrow_focus: "  Abrir o dia revisando o contrato  ",
      self_rating: 4,
      mood: "good",
      created_at: "2026-04-10T12:00:00.000Z",
      updated_at: "2026-04-10T12:00:00.000Z",
    });

    expect(entry.checklist_json).toEqual([
      {
        id: "a",
        title: "Fechar proposta principal",
        completed: true,
      },
    ]);
    expect(entry.tomorrow_focus).toBe("Abrir o dia revisando o contrato");
  });
});
