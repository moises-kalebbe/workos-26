"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;
const AGENDA_REDIRECT_PATH = "/agenda";

export default function SSOCallbackPage() {
  if (DEV_AUTH_USER_ID) {
    redirect(AGENDA_REDIRECT_PATH);
  }

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={AGENDA_REDIRECT_PATH}
      signInFallbackRedirectUrl={AGENDA_REDIRECT_PATH}
      signUpForceRedirectUrl={AGENDA_REDIRECT_PATH}
      signUpFallbackRedirectUrl={AGENDA_REDIRECT_PATH}
    />
  );
}
