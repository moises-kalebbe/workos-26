export type AgendaEventsCacheEntry<TEvent = unknown> = {
  fetchedAt: string;
  events: TEvent[];
};

const AGENDA_CACHE_KEY_PREFIX = "agenda-events-cache:v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function buildAgendaCacheKey(userId: string, timeMin: string, timeMax: string) {
  return `${AGENDA_CACHE_KEY_PREFIX}:${userId}:${timeMin}:${timeMax}`;
}

export function isCacheFresh(fetchedAt: string, ttlMs: number) {
  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (Number.isNaN(fetchedAtMs)) return false;
  return Date.now() - fetchedAtMs <= ttlMs;
}

export function readAgendaCache<TEvent = unknown>(key: string): AgendaEventsCacheEntry<TEvent> | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AgendaEventsCacheEntry<TEvent>;
    if (!parsed || !Array.isArray(parsed.events) || typeof parsed.fetchedAt !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeAgendaCache<TEvent = unknown>(key: string, entry: AgendaEventsCacheEntry<TEvent>) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage quota or unavailable; ignore to avoid breaking agenda rendering.
  }
}

export function clearAgendaCacheForUser(userId: string) {
  if (!canUseStorage()) return;

  const userPrefix = `${AGENDA_CACHE_KEY_PREFIX}:${userId}:`;

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(userPrefix)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore and keep app flow.
  }
}
