import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClerkBridge, setClerkBridge } from "@/lib/clerkBridge";
import { localDbClient } from "@/lib/localDbClient";

describe("localDbClient", () => {
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

  it("preserves insert action when select() is chained for returning rows", async () => {
    await localDbClient
      .from("time_sessions")
      .insert({ project_id: "project_1" })
      .select()
      .single();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(url).toBe("/api/db/time_sessions");
    expect(payload.action).toBe("insert");
    expect(payload.select).toBe("*");
    expect(payload.values).toEqual({ project_id: "project_1" });
  });

  it("serializes is/gte/lte filters for API queries", async () => {
    await localDbClient
      .from("time_sessions")
      .select("id, started_at")
      .is("ended_at", null)
      .gte("started_at", "2026-03-01T00:00:00.000Z")
      .lte("started_at", "2026-03-31T23:59:59.999Z")
      .maybeSingle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.action).toBe("select");
    expect(payload.filters).toEqual([
      { type: "is", column: "ended_at", value: null },
      { type: "gte", column: "started_at", value: "2026-03-01T00:00:00.000Z" },
      { type: "lte", column: "started_at", value: "2026-03-31T23:59:59.999Z" },
    ]);
  });
});
