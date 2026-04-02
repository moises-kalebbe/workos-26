import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  exchangeGoogleAuthorizationCode,
  getAgendaRedirectUrl,
  getSignInRedirectUrl,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "@/lib/googleOAuth";
import { storeGoogleToken } from "@/lib/googleCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearStateCookie(response: NextResponse) {
  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  let userId: string;

  try {
    const user = await requireAuth(request);
    userId = user.id;
  } catch {
    return NextResponse.redirect(getSignInRedirectUrl(request));
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const googleError = url.searchParams.get("error");
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(
      getAgendaRedirectUrl(request, "error", "Estado invalido na autenticacao do Google"),
    );
    clearStateCookie(response);
    return response;
  }

  if (googleError) {
    const response = NextResponse.redirect(getAgendaRedirectUrl(request, "denied"));
    clearStateCookie(response);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(
      getAgendaRedirectUrl(request, "error", "Google nao retornou codigo de autorizacao"),
    );
    clearStateCookie(response);
    return response;
  }

  try {
    const tokens = await exchangeGoogleAuthorizationCode(request, code);
    await storeGoogleToken(userId, {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
    });

    const response = NextResponse.redirect(getAgendaRedirectUrl(request, "connected"));
    clearStateCookie(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao concluir OAuth do Google";
    const response = NextResponse.redirect(getAgendaRedirectUrl(request, "error", message));
    clearStateCookie(response);
    return response;
  }
}
