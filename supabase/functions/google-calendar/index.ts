import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Store tokens after Google OAuth sign-in
    if (action === "store-token") {
      const { access_token, refresh_token, expires_at } = await req.json();

      const { error } = await supabase.from("google_tokens").upsert(
        {
          user_id: userId,
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expires_at
            ? new Date(expires_at * 1000).toISOString()
            : null,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Error storing token:", error);
        return new Response(
          JSON.stringify({ error: "Failed to store token" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch events
    if (action === "events") {
      const { data: tokenRow, error: tokenError } = await supabase
        .from("google_tokens")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        return new Response(
          JSON.stringify({ error: "not_connected", message: "Google Calendar not connected" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let accessToken = tokenRow.access_token;

      // Check if token is expired and refresh
      if (
        tokenRow.expires_at &&
        new Date(tokenRow.expires_at) < new Date() &&
        tokenRow.refresh_token
      ) {
        const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
        const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
          const refreshRes = await fetch(
            "https://oauth2.googleapis.com/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: tokenRow.refresh_token,
                grant_type: "refresh_token",
              }),
            }
          );

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            accessToken = refreshData.access_token;

            await supabase.from("google_tokens").update({
              access_token: refreshData.access_token,
              expires_at: new Date(
                Date.now() + refreshData.expires_in * 1000
              ).toISOString(),
            }).eq("user_id", userId);
          }
        }
      }

      // Fetch calendar events
      const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
      const timeMax =
        url.searchParams.get("timeMax") ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "50",
          }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!calendarRes.ok) {
        const errText = await calendarRes.text();
        console.error("Google Calendar API error:", calendarRes.status, errText);

        if (calendarRes.status === 401) {
          // Token is invalid, remove it
          await supabase
            .from("google_tokens")
            .delete()
            .eq("user_id", userId);

          return new Response(
            JSON.stringify({ error: "not_connected", message: "Token expired, please reconnect" }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ error: "calendar_error", message: errText }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const calendarData = await calendarRes.json();

      const events = (calendarData.items || []).map((e: any) => ({
        id: e.id,
        summary: e.summary || "(Sem título)",
        description: e.description || null,
        location: e.location || null,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
        htmlLink: e.htmlLink,
        status: e.status,
        colorId: e.colorId,
      }));

      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Disconnect
    if (action === "disconnect") {
      await supabase.from("google_tokens").delete().eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
