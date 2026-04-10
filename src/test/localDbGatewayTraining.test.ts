import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeLocalDbQuery, LOCAL_DB_TABLES } from "@/lib/localDbGateway";

const dbMocks = vi.hoisted(() => ({
  ensureDatabaseConnection: vi.fn(async () => undefined),
  unsafe: vi.fn(async () => []),
}));

vi.mock("@/lib/db", () => ({
  ensureDatabaseConnection: dbMocks.ensureDatabaseConnection,
  sql: {
    unsafe: dbMocks.unsafe,
  },
}));

describe("localDbGateway training tables", () => {
  beforeEach(() => {
    dbMocks.ensureDatabaseConnection.mockClear();
    dbMocks.unsafe.mockClear();
  });

  it("registers the training tables in the local gateway", () => {
    expect(LOCAL_DB_TABLES.has("athlete_profiles")).toBe(true);
    expect(LOCAL_DB_TABLES.has("training_programs")).toBe(true);
    expect(LOCAL_DB_TABLES.has("training_blocks")).toBe(true);
    expect(LOCAL_DB_TABLES.has("training_sessions")).toBe(true);
    expect(LOCAL_DB_TABLES.has("training_session_exercises")).toBe(true);
    expect(LOCAL_DB_TABLES.has("training_logs")).toBe(true);
    expect(LOCAL_DB_TABLES.has("training_exercise_logs")).toBe(true);
    expect(LOCAL_DB_TABLES.has("athlete_measurements")).toBe(true);
    expect(LOCAL_DB_TABLES.has("mental_game_prompts")).toBe(true);
    expect(LOCAL_DB_TABLES.has("mental_game_entries")).toBe(true);
  });

  it("allows selecting mental prompts without ownership filtering", async () => {
    await executeLocalDbQuery("mental_game_prompts", "user_123", {
      action: "select",
      order: [{ column: "position", ascending: true }],
    });

    expect(dbMocks.ensureDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(dbMocks.unsafe).toHaveBeenCalledTimes(1);
    const [query] = dbMocks.unsafe.mock.calls[0] as unknown as [string, ...unknown[]];
    expect(query).toContain('FROM "mental_game_prompts" t');
    expect(query).not.toContain('"user_id"');
  });

  it("rejects mental prompt mutations from the local gateway", async () => {
    await expect(
      executeLocalDbQuery("mental_game_prompts", "user_123", {
        action: "insert",
        values: { position: 99, title: "Novo prompt" },
      }),
    ).rejects.toThrow("Prompt catalog is read-only");

    expect(dbMocks.ensureDatabaseConnection).not.toHaveBeenCalled();
    expect(dbMocks.unsafe).not.toHaveBeenCalled();
  });
});
