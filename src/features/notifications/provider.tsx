"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buildDashboardAttentionQueue } from "@/features/dashboard/model";
import type {
  DashboardFinancialEntry,
  DashboardProject,
  DashboardSessionRow,
  DashboardTaskRow,
} from "@/features/dashboard/types";
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_POLL_INTERVAL_MS } from "@/features/notifications/defaults";
import { NotificationCenterContext } from "@/features/notifications/context";
import type {
  NotificationCandidate,
  NotificationPermissionState,
  NotificationPreferences,
  NotificationSuppressionState,
} from "@/features/notifications/types";
import {
  buildNotificationCandidates,
  getNotificationSuppressionState,
  normalizeNotificationPreferences,
} from "@/features/notifications/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { db } from "@/lib/dbClient";
import type { MeetingMinutesItem } from "@/types";

const DELIVERY_STORAGE_PREFIX = "workos:notification-ledger:v1";
const DELIVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DeliveryLedger = Record<string, string>;

function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

function readLedger(userId: string) {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(`${DELIVERY_STORAGE_PREFIX}:${userId}`);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as DeliveryLedger;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeLedger(userId: string, ledger: DeliveryLedger) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${DELIVERY_STORAGE_PREFIX}:${userId}`, JSON.stringify(ledger));
}

function pruneLedger(ledger: DeliveryLedger, now: number) {
  return Object.fromEntries(
    Object.entries(ledger).filter(([, deliveredAt]) => {
      const parsed = new Date(deliveredAt).getTime();
      return Number.isFinite(parsed) && now - parsed <= DELIVERY_TTL_MS;
    }),
  );
}

function normalizeProfileTimezone(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : "America/Sao_Paulo";
}

function showToast(candidate: NotificationCandidate) {
  const message = {
    description: candidate.description,
    duration: 8000,
  };

  if (candidate.tone === "danger") {
    toast.error(candidate.title, message);
    return;
  }

  if (candidate.tone === "warning") {
    toast.warning(candidate.title, message);
    return;
  }

  toast(candidate.title, message);
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { events: calendarEvents, fetchEvents } = useGoogleCalendar();

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>(getNotificationPermissionState());
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [suppressed, setSuppressed] = useState<NotificationSuppressionState>({
    quietHours: false,
    weekend: false,
  });
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<string | null>(null);
  const [lastDeliveredAt, setLastDeliveredAt] = useState<string | null>(null);

  const ledgerRef = useRef<DeliveryLedger>({});
  const channelRef = useRef<BroadcastChannel | null>(null);

  const loadPreferences = useCallback(async () => {
    if (!user) {
      setReady(true);
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setTimezone("America/Sao_Paulo");
      return;
    }

    const [profileRes, prefsRes] = await Promise.all([
      db.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
      db.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    setTimezone(normalizeProfileTimezone(profileRes.data?.timezone));
    setPreferences(normalizeNotificationPreferences((prefsRes.data || null) as Record<string, unknown> | null));
    setReady(true);
  }, [user]);

  const savePreferences = useCallback(async (next: NotificationPreferences) => {
    if (!user) return;

    setSaving(true);
    const normalized = normalizeNotificationPreferences(next as unknown as Record<string, unknown>);

    const { error } = await db.from("notification_preferences").upsert(
      {
        user_id: user.id,
        ...normalized,
      },
      { onConflict: "user_id" },
    );

    setSaving(false);

    if (error) {
      throw new Error(error.message || "Nao foi possivel salvar as notificacoes.");
    }

    setPreferences(normalized);
  }, [user]);

  const resetPreferences = useCallback(async () => {
    await savePreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  }, [savePreferences]);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setPermission("unsupported");
      return "unsupported";
    }

    const next = await Notification.requestPermission();
    setPermission(next);
    return next;
  }, []);

  const markDelivered = useCallback((key: string, deliveredAt: string) => {
    if (!user) return;

    const nextLedger = pruneLedger(
      {
        ...ledgerRef.current,
        [key]: deliveredAt,
      },
      Date.now(),
    );

    ledgerRef.current = nextLedger;
    writeLedger(user.id, nextLedger);
    channelRef.current?.postMessage({ type: "delivered", key, deliveredAt });
    setLastDeliveredAt(deliveredAt);
  }, [user]);

  const deliverCandidate = useCallback((candidate: NotificationCandidate) => {
    const pageVisible = typeof document !== "undefined" ? !document.hidden : true;
    const canUseBrowser = permission === "granted" && preferences.browser_enabled && typeof window !== "undefined";

    if (!pageVisible && canUseBrowser) {
      const browserNotification = new Notification(candidate.title, {
        body: candidate.description,
        tag: candidate.key,
      });

      browserNotification.onclick = () => {
        if (candidate.href) {
          if (candidate.external) {
            window.open(candidate.href, "_blank", "noopener,noreferrer");
          } else {
            window.location.href = candidate.href;
          }
        }

        browserNotification.close();
        window.focus();
      };

      return true;
    }

    if (preferences.toast_enabled) {
      showToast(candidate);
      return true;
    }

    if (canUseBrowser) {
      const browserNotification = new Notification(candidate.title, {
        body: candidate.description,
        tag: candidate.key,
      });

      browserNotification.onclick = () => {
        if (candidate.href) {
          if (candidate.external) {
            window.open(candidate.href, "_blank", "noopener,noreferrer");
          } else {
            window.location.href = candidate.href;
          }
        }

        browserNotification.close();
        window.focus();
      };

      return true;
    }

    return false;
  }, [permission, preferences.browser_enabled, preferences.toast_enabled]);

  const sendTestNotification = useCallback(() => {
    const candidate: NotificationCandidate = {
      key: `test:${Date.now()}`,
      title: "Teste de notificacao",
      description: "Seu WorkOS esta pronto para alertar reunioes, tarefas e financeiro.",
      tone: "info",
      href: "/settings?tab=preferences",
      external: false,
      source: "attention_queue",
      sourceId: "test",
    };

    if (!deliverCandidate(candidate)) {
      toast.error("Ative notificacoes do navegador ou o fallback por toast.");
    }
  }, [deliverCandidate]);

  const refreshCalendar = useCallback(async () => {
    if (!user) return;
    if (!preferences.meetings_enabled && !preferences.meeting_follow_up_enabled) return;

    const now = new Date();
    const timeMin = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    await fetchEvents(timeMin, timeMax);
  }, [fetchEvents, preferences.meeting_follow_up_enabled, preferences.meetings_enabled, user]);

  const evaluateNotifications = useCallback(async () => {
    if (!user || !ready || !preferences.enabled) {
      return;
    }

    const now = new Date();
    const recentWindowIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [profileRes, projectRes, taskRes, sessionRes, financialRes, meetingItemsRes] = await Promise.all([
      db.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
      db
        .from("projects")
        .select("id, name, client, hourly_rate, daily_agreed_hours, color, status")
        .eq("user_id", user.id)
        .order("name"),
      db
        .from("tasks")
        .select("id, title, project_id, skill_document_id, column_index, priority, urgency, importance, due_date, client, created_at, completed_at")
        .eq("user_id", user.id)
        .lt("column_index", 2)
        .order("position"),
      db
        .from("time_sessions")
        .select("id, project_id, started_at, ended_at, duration_seconds, project:projects(id, name, client, hourly_rate, daily_agreed_hours, color)")
        .eq("user_id", user.id)
        .gte("started_at", recentWindowIso)
        .order("started_at", { ascending: false })
        .limit(400),
      db
        .from("financial_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),
      db
        .from("agenda_meeting_topics")
        .select("*")
        .eq("user_id", user.id)
        .order("meeting_start_at", { ascending: false }),
    ]);

    const nextTimezone = normalizeProfileTimezone(profileRes.data?.timezone);
    if (nextTimezone !== timezone) {
      setTimezone(nextTimezone);
    }

    const projectMap = new Map(
      (((projectRes.data || []) as DashboardProject[]) || []).map((project) => [project.id, project]),
    );

    const enrichedFinancialEntries = (((financialRes.data || []) as DashboardFinancialEntry[]) || []).map((entry) => ({
      ...entry,
      project: entry.project_id ? projectMap.get(entry.project_id) || null : null,
    }));

    const attentionQueue = buildDashboardAttentionQueue({
      now,
      projects: (projectRes.data || []) as DashboardProject[],
      tasks: (taskRes.data || []) as DashboardTaskRow[],
      sessions: (sessionRes.data || []) as DashboardSessionRow[],
      calendarEvents,
      financialEntries: enrichedFinancialEntries,
      meetingItems: (meetingItemsRes.data || []) as MeetingMinutesItem[],
      activeTimerProjectId: null,
    });

    const built = buildNotificationCandidates({
      now,
      timezone: nextTimezone,
      pollWindowMs: NOTIFICATION_POLL_INTERVAL_MS,
      attentionQueue,
      calendarEvents,
      preferences,
    });

    setSuppressed(built.suppressed);
    setLastEvaluatedAt(now.toISOString());

    if (built.suppressed.quietHours || built.suppressed.weekend) {
      return;
    }

    const freshCandidates = built.candidates
      .filter((candidate) => !ledgerRef.current[candidate.key])
      .slice(0, preferences.max_notifications_per_cycle);

    for (const candidate of freshCandidates) {
      if (deliverCandidate(candidate)) {
        markDelivered(candidate.key, now.toISOString());
      }
    }
  }, [calendarEvents, deliverCandidate, markDelivered, preferences, ready, timezone, user]);

  useEffect(() => {
    setPermission(getNotificationPermissionState());

    const handleVisibility = () => {
      setPermission(getNotificationPermissionState());
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setReady(true);
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setSuppressed(getNotificationSuppressionState(new Date(), "America/Sao_Paulo", DEFAULT_NOTIFICATION_PREFERENCES));
      ledgerRef.current = {};
      return;
    }

    const nextLedger = pruneLedger(readLedger(user.id), Date.now());
    ledgerRef.current = nextLedger;
    writeLedger(user.id, nextLedger);
    void loadPreferences();
  }, [loadPreferences, user]);

  useEffect(() => {
    if (!user || typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel("workos-notifications");
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type !== "delivered") return;
      if (typeof event.data.key !== "string" || typeof event.data.deliveredAt !== "string") return;

      ledgerRef.current = {
        ...ledgerRef.current,
        [event.data.key]: event.data.deliveredAt,
      };
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !ready) return;

    void refreshCalendar();
    const intervalId = window.setInterval(() => {
      void refreshCalendar();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [ready, refreshCalendar, user]);

  useEffect(() => {
    if (!user || !ready) return;

    void evaluateNotifications();
    const intervalId = window.setInterval(() => {
      void evaluateNotifications();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [evaluateNotifications, ready, user]);

  const value = useMemo(() => ({
    ready,
    saving,
    permission,
    preferences,
    suppressed,
    lastEvaluatedAt,
    lastDeliveredAt,
    requestPermission,
    savePreferences,
    resetPreferences,
    sendTestNotification,
  }), [
    lastDeliveredAt,
    lastEvaluatedAt,
    permission,
    preferences,
    ready,
    requestPermission,
    resetPreferences,
    savePreferences,
    saving,
    sendTestNotification,
    suppressed,
  ]);

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
}
