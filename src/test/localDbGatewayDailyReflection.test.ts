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

describe("localDbGateway daily reflection tables", () => {
  beforeEach(() => {
    dbMocks.ensureDatabaseConnection.mockClear();
    dbMocks.unsafe.mockClear();
  });

  it("registers the daily reflection tables in the local gateway", () => {
    expect(LOCAL_DB_TABLES.has("daily_reflection_prompts")).toBe(true);
    expect(LOCAL_DB_TABLES.has("daily_reflection_settings")).toBe(true);
    expect(LOCAL_DB_TABLES.has("daily_reflection_entries")).toBe(true);
  });

  it("allows selecting prompts without ownership filtering", async () => {
    await executeLocalDbQuery("daily_reflection_prompts", "user_123", {
      action: "select",
      order: [{ column: "position", ascending: true }],
    });

    expect(dbMocks.ensureDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(dbMocks.unsafe).toHaveBeenCalledTimes(1);
    const [query] = dbMocks.unsafe.mock.calls[0] as unknown as [string, ...unknown[]];
    expect(query).toContain('FROM "daily_reflection_prompts" t');
    expect(query).not.toContain('"user_id"');
  });

  it("rejects prompt mutations from the local gateway", async () => {
    await expect(
      executeLocalDbQuery("daily_reflection_prompts", "user_123", {
        action: "insert",
        values: { position: 51, title: "Novo prompt" },
      }),
    ).rejects.toThrow("Prompt catalog is read-only");

    expect(dbMocks.ensureDatabaseConnection).not.toHaveBeenCalled();
    expect(dbMocks.unsafe).not.toHaveBeenCalled();
  });
});
