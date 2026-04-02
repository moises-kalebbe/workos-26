import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  buildGoogleOauthUrl,
  getSignInRedirectUrl,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "@/lib/googleOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.redirect(getSignInRedirectUrl(request));
  }

  try {
    const state = randomBytes(24).toString("hex");
    const response = NextResponse.redirect(buildGoogleOauthUrl(request, state));

    response.cookies.set({
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar OAuth do Google";
    return NextResponse.redirect(new URL(`/agenda?google=error&message=${encodeURIComponent(message)}`, getSignInRedirectUrl(request).origin));
  }
}
