"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { redirect, useSearchParams } from "next/navigation";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;
const AGENDA_REDIRECT_PATH = "/agenda";

export default function SSOCallbackPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get("redirect_url");
  const finalRedirectUrl = redirectUrl || AGENDA_REDIRECT_PATH;

  if (DEV_AUTH_USER_ID) {
    redirect(finalRedirectUrl);
  }

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={finalRedirectUrl}
      signInFallbackRedirectUrl={finalRedirectUrl}
      signUpForceRedirectUrl={finalRedirectUrl}
      signUpFallbackRedirectUrl={finalRedirectUrl}
    />
  );
}
