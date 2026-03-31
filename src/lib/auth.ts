import { createClerkClient, verifyToken } from "@clerk/backend";

export type AuthenticatedUser = {
  id: string;
};

const secretKey = process.env.CLERK_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;

const clerkClient = secretKey && publishableKey
  ? createClerkClient({
      secretKey,
      publishableKey,
    })
  : null;
const devAuthUserId = process.env.DEV_AUTH_USER_ID || process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

const CLERK_COOKIE_NAMES = [
  "__session",
  "__refresh",
  "__client_uat",
  "__clerk_handshake",
  "__clerk_db_jwt",
  "__clerk_redirect_count",
  "__clerk_handshake_nonce",
];

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function decodeJwtPayload(token: string) {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) {
      return null;
    }

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSafeTokenDebug(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { readable: false };
  }

  return {
    readable: true,
    iss: payload.iss ?? null,
    azp: payload.azp ?? null,
    aud: payload.aud ?? null,
    sub: payload.sub ?? null,
    sid: payload.sid ?? null,
    typ: payload.typ ?? null,
    v: payload.v ?? null,
  };
}

export function appendClerkResetHeaders(headers: Headers) {
  for (const cookieName of CLERK_COOKIE_NAMES) {
    headers.append(
      "Set-Cookie",
      `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`,
    );
  }
}

export async function getRequestUser(request: Request): Promise<AuthenticatedUser | null> {
  if (process.env.NODE_ENV !== "production" && devAuthUserId) {
    return { id: devAuthUserId };
  }

  if (!clerkClient) {
    console.warn("[auth] clerk backend client is not configured");
    return null;
  }

  try {
    const requestState = await clerkClient.authenticateRequest(request, {
      acceptsToken: "any",
    });
    const authObject = requestState.toAuth();

    if (authObject && "userId" in authObject && authObject.userId) {
      const hasSessionToken = "sessionId" in authObject && authObject.sessionId != null;
      console.log("[auth] request authenticated", {
        hasSessionToken,
        strategy: "authenticateRequest",
      });
      return { id: authObject.userId };
    }
  } catch (error) {
    console.warn("[auth] authenticateRequest failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const bearerToken = getBearerToken(request);

  if (bearerToken && secretKey) {
    try {
      const payload = await verifyToken(bearerToken, { secretKey });
      if (typeof payload.sub === "string" && payload.sub.length > 0) {
        console.log("[auth] request authenticated", {
          hasSessionToken: payload.sid != null,
          strategy: "verifyToken",
        });
        return { id: payload.sub };
      }
    } catch (error) {
      console.warn("[auth] verifyToken failed", {
        message: error instanceof Error ? error.message : String(error),
        token: getSafeTokenDebug(bearerToken),
      });
    }
  }

  console.warn("[auth] unauthorized request", {
    hasAuthorizationHeader: request.headers.has("authorization"),
    hasCookieHeader: request.headers.has("cookie"),
    token: bearerToken ? getSafeTokenDebug(bearerToken) : null,
  });
  return null;
}

export async function requireAuth(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function getAuthUser() {
  return null;
}
