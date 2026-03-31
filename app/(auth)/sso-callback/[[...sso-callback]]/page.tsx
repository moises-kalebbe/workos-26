"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect } from "react";
import { redirect, useSearchParams } from "next/navigation";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;
const AGENDA_REDIRECT_PATH = "/agenda";

export default function SSOCallbackPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get("redirect_url");

  if (DEV_AUTH_USER_ID) {
    redirect(redirectUrl || AGENDA_REDIRECT_PATH);
  }

  useEffect(() => {
    if (redirectUrl) {
      window.location.replace(redirectUrl);
    }
  }, [redirectUrl]);

  if (redirectUrl) {
    return null;
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
