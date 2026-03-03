import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
  status: string;
  colorId: string | null;
}

export function useGoogleCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (timeMin?: string, timeMax?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setConnected(false);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ action: "events" });
      if (timeMin) params.set("timeMin", timeMin);
      if (timeMax) params.set("timeMax", timeMax);

      const { data, error: fnError } = await supabase.functions.invoke(
        "google-calendar",
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          body: undefined,
        }
      );

      // Use fetch directly to pass query params
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await res.json();

      if (result.error === "not_connected") {
        setConnected(false);
        setEvents([]);
      } else if (result.events) {
        setConnected(true);
        setEvents(result.events);
      } else if (result.error) {
        setError(result.message || result.error);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const connectGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/agenda",
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setError(error.message);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?action=disconnect`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    setConnected(false);
    setEvents([]);
  }, []);

  // Store token after OAuth redirect
  const storeTokenFromSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;

    if (providerToken) {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar?action=store-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: providerToken,
            refresh_token: providerRefreshToken,
            expires_at: session.expires_at,
          }),
        }
      );
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const init = async () => {
      const stored = await storeTokenFromSession();
      await fetchEvents();
    };
    init();
  }, [fetchEvents, storeTokenFromSession]);

  return {
    events,
    loading,
    connected,
    error,
    connectGoogle,
    disconnect,
    fetchEvents,
  };
}
