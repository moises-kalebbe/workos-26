const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];

export const GOOGLE_OAUTH_STATE_COOKIE = "google_calendar_oauth_state";
export const GOOGLE_OAUTH_USER_COOKIE = "google_calendar_oauth_user";

function getPublicAppOrigin(request: Request) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host) {
    const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google OAuth client is not configured");
  }

  return clientId;
}

function getGoogleClientSecret() {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("Google OAuth client secret is not configured");
  }

  return clientSecret;
}

export function getGoogleOauthRedirectUri(request: Request) {
  return new URL("/api/google-calendar/callback", getPublicAppOrigin(request)).toString();
}

export function getAgendaRedirectUrl(request: Request, status?: "connected" | "denied" | "error", message?: string) {
  const url = new URL("/agenda", getPublicAppOrigin(request));
  if (status) {
    url.searchParams.set("google", status);
  }
  if (message) {
    url.searchParams.set("message", message);
  }
  return url;
}

export function getSignInRedirectUrl(request: Request) {
  const url = new URL("/sign-in", getPublicAppOrigin(request));
  url.searchParams.set("redirect_url", "/agenda");
  return url;
}

export function buildGoogleOauthUrl(request: Request, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", getGoogleOauthRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGoogleAuthorizationCode(request: Request, code: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleOauthRedirectUri(request),
    }),
  });

  const text = await tokenResponse.text();
  let data: Record<string, unknown> | null = null;

  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  if (!tokenResponse.ok) {
    throw new Error(
      (typeof data?.error_description === "string" && data.error_description) ||
        (typeof data?.error === "string" && data.error) ||
        "Google token exchange failed",
    );
  }

  const accessToken = typeof data?.access_token === "string" ? data.access_token : null;
  const refreshToken = typeof data?.refresh_token === "string" ? data.refresh_token : null;
  const expiresIn = typeof data?.expires_in === "number" ? data.expires_in : null;

  if (!accessToken) {
    throw new Error("Google did not return an access token");
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
  };
}
