import { describe, expect, it } from "vitest";
import { createEmptyTreinoSetDraft, isTreinoSetDraftFilled } from "@/features/treino/hooks";

describe("treino hooks helpers", () => {
  it("considera uma serie preenchida quando so ha rpe", () => {
    const row = {
      ...createEmptyTreinoSetDraft(1),
      rpe: "8",
    };

    expect(isTreinoSetDraftFilled(row)).toBe(true);
  });

  it("considera uma serie preenchida quando so ha notas", () => {
    const row = {
      ...createEmptyTreinoSetDraft(1),
      notes: "pegada mais fechada",
    };

    expect(isTreinoSetDraftFilled(row)).toBe(true);
  });

  it("considera uma serie vazia quando nao ha nenhum dado util", () => {
    expect(isTreinoSetDraftFilled(createEmptyTreinoSetDraft(1))).toBe(false);
  });
});
