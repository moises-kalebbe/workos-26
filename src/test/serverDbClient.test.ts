import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerDbClient } from "@/lib/serverDbClient";
import { executeLocalDbQuery } from "@/lib/localDbGateway";

vi.mock("@/lib/localDbGateway", () => ({
  executeLocalDbQuery: vi.fn(),
}));

describe("createServerDbClient", () => {
  beforeEach(() => {
    vi.mocked(executeLocalDbQuery).mockResolvedValue([{ id: "row_1" }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves update action when select() is chained for returning rows", async () => {
    const db = createServerDbClient("user_123") as any;

    await db
      .from("projects")
      .update({ name: "Novo nome" })
      .eq("id", "project_1")
      .select("*")
      .single();

    expect(executeLocalDbQuery).toHaveBeenCalledWith(
      "projects",
      "user_123",
      expect.objectContaining({
        action: "update",
        select: "*",
        filters: [{ type: "eq", column: "id", value: "project_1" }],
        values: { name: "Novo nome" },
      }),
    );
  });

  it("serializes is/gte/lte filters for server-side queries", async () => {
    const db = createServerDbClient("user_123") as any;

    await db
      .from("time_sessions")
      .select("*")
      .is("ended_at", null)
      .gte("started_at", "2026-03-01")
      .lte("started_at", "2026-03-31")
      .maybeSingle();

    expect(executeLocalDbQuery).toHaveBeenCalledWith(
      "time_sessions",
      "user_123",
      expect.objectContaining({
        action: "select",
        filters: [
          { type: "is", column: "ended_at", value: null },
          { type: "gte", column: "started_at", value: "2026-03-01" },
          { type: "lte", column: "started_at", value: "2026-03-31" },
        ],
      }),
    );
  });
});
