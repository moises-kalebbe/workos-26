"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

export default function SSOCallbackPage() {
  if (DEV_AUTH_USER_ID) {
    redirect("/");
  }

  return <AuthenticateWithRedirectCallback />;
}
