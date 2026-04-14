import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClerkBridge, setClerkBridge } from "@/lib/clerkBridge";
import { treinoApi } from "@/features/treino/api";

describe("treinoApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    setClerkBridge({
      userId: "user_123",
      getToken: async () => "token_123",
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "row_1" }] }),
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    clearClerkBridge();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("salva checkpoint com upsert por usuario e data", async () => {
    await treinoApi.saveMeasurement({
      userId: "user_123",
      measurementDate: "2026-04-12",
      weightKg: 101.5,
      waistCm: 92,
      notesMd: "ajuste leve",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.action).toBe("upsert");
    expect(payload.onConflict).toBe("user_id,measurement_date");
    expect(payload.values).toMatchObject({
      user_id: "user_123",
      measurement_date: "2026-04-12",
      weight_kg: 101.5,
      waist_cm: 92,
      notes_md: "ajuste leve",
    });
  });

  it("exclui o log da sessao pelo usuario e pela sessao", async () => {
    await treinoApi.deleteTrainingLog({
      userId: "user_123",
      sessionId: "session_456",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(url).toBe("/api/db/training_logs");
    expect(payload.action).toBe("delete");
    expect(payload.filters).toEqual([
      { type: "eq", column: "user_id", value: "user_123" },
      { type: "eq", column: "training_session_id", value: "session_456" },
    ]);
  });

  it("exclui checkpoint pelo id e usuario", async () => {
    await treinoApi.deleteMeasurement({
      userId: "user_123",
      measurementId: "measurement_789",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(url).toBe("/api/db/athlete_measurements");
    expect(payload.action).toBe("delete");
    expect(payload.filters).toEqual([
      { type: "eq", column: "user_id", value: "user_123" },
      { type: "eq", column: "id", value: "measurement_789" },
    ]);
  });

  it("normaliza exercicios legados do treino para equivalentes de academia comum", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "exercise_1",
            user_id: "user_123",
            training_session_id: "session_1",
            prescribed_order: 3,
            exercise_name: "Medicine ball scoop toss",
            category: "power",
            prescribed_sets: 4,
            target_rep_min: 4,
            target_rep_max: 4,
            rest_seconds: 60,
            tempo: "X",
            load_mode: "rpe",
            target_rpe: 7,
            target_rir: null,
            progression_rule: "Maior rotação sem perder eixo.",
            notes: null,
            created_at: "2026-04-14T00:00:00.000Z",
            updated_at: "2026-04-14T00:00:00.000Z",
          },
          {
            id: "exercise_2",
            user_id: "user_123",
            training_session_id: "session_1",
            prescribed_order: 6,
            exercise_name: "Shuttle curto",
            category: "conditioning",
            prescribed_sets: 4,
            target_rep_min: 15,
            target_rep_max: 15,
            rest_seconds: 45,
            tempo: null,
            load_mode: "distance",
            target_rpe: 8,
            target_rir: null,
            progression_rule: "Agressividade sem perder postura.",
            notes: "15 metros totais por repetição.",
            created_at: "2026-04-14T00:00:00.000Z",
            updated_at: "2026-04-14T00:00:00.000Z",
          },
        ],
      }),
    });

    const result = await treinoApi.getSessionExercises(["session_1"]);

    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({
      exercise_name: "Jump shrug com barra",
      rest_seconds: 75,
      notes: "Barra leve ou com anilhas pequenas.",
    });
    expect(result.data?.[1]).toMatchObject({
      exercise_name: "Bike sprint estendido",
      load_mode: "time",
      target_rep_min: 15,
      target_rep_max: 15,
      notes: "15 segundos forte / 45 fácil.",
    });
  });
});
