import type { SupabaseClient } from "@supabase/supabase-js";

export type QuickStartEventName =
  | "quick_start_clicked"
  | "quick_start_retry_clicked"
  | "quick_start_no_suggestion"
  | "quick_start_suggestion_accepted"
  | "quick_start_fallback_created_task"
  | "focus_session_started";

export async function trackQuickStartEvent(params: {
  db: SupabaseClient;
  userId: string;
  eventName: QuickStartEventName;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const payload = {
    ...params.payload,
    source: "quick_start",
    event_name: params.eventName,
  };

  console.info("[quick-start:event]", {
    userId: params.userId,
    eventName: params.eventName,
    payload,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("workos:quick-start-event", {
        detail: {
          userId: params.userId,
          eventName: params.eventName,
          payload,
        },
      }),
    );
  }

  const { error } = await params.db.from("quick_start_events").insert({
    user_id: params.userId,
    event_name: params.eventName,
    payload,
  });

  if (error) {
    console.warn("[quick-start:event] persist failed", error.message);
  }
}
