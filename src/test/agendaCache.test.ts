import { describe, expect, it, beforeEach } from "vitest";
import {
  buildAgendaCacheKey,
  clearAgendaCacheForUser,
  isCacheFresh,
  readAgendaCache,
  writeAgendaCache,
} from "@/lib/agendaCache";

describe("agendaCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("builds a stable cache key per user and range", () => {
    const key = buildAgendaCacheKey("user-1", "2026-03-01T00:00:00.000Z", "2026-03-07T23:59:59.999Z");
    expect(key).toBe("agenda-events-cache:v1:user-1:2026-03-01T00:00:00.000Z:2026-03-07T23:59:59.999Z");
  });

  it("checks freshness based on ttl", () => {
    const freshAt = new Date(Date.now() - 1_000).toISOString();
    const staleAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();

    expect(isCacheFresh(freshAt, 15 * 60 * 1000)).toBe(true);
    expect(isCacheFresh(staleAt, 15 * 60 * 1000)).toBe(false);
  });

  it("writes and reads cache entries", () => {
    const key = buildAgendaCacheKey("user-1", "a", "b");
    const entry = {
      fetchedAt: "2026-03-04T12:00:00.000Z",
      events: [{ id: "evt-1" }],
    };

    writeAgendaCache(key, entry);

    const loaded = readAgendaCache<{ id: string }>(key);
    expect(loaded).toEqual(entry);
  });

  it("clears only keys for the selected user", () => {
    const user1Key = buildAgendaCacheKey("user-1", "a", "b");
    const user2Key = buildAgendaCacheKey("user-2", "a", "b");

    writeAgendaCache(user1Key, { fetchedAt: new Date().toISOString(), events: [{ id: "u1" }] });
    writeAgendaCache(user2Key, { fetchedAt: new Date().toISOString(), events: [{ id: "u2" }] });

    clearAgendaCacheForUser("user-1");

    expect(readAgendaCache(user1Key)).toBeNull();
    expect(readAgendaCache(user2Key)).not.toBeNull();
  });
});
