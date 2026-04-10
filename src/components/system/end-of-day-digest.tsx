"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEndOfDayDigest } from "@/hooks/useEndOfDayDigest";

export function EndOfDayDigest() {
  const { user } = useAuth();
  useEndOfDayDigest(user?.id ?? null);
  return null;
}
