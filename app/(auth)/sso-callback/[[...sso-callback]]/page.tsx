"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function SSOCallbackPage() {
  const searchParams = useSearchParams();
  const redirectUrlComplete = searchParams.get("redirect_url_complete") || "/agenda";

  return (
    <AuthenticateWithRedirectCallback
      fallback={<div>Processando...</div>}
    />
  );
}


