"use client";

import { Suspense } from "react";
import VaultPage from "@/views/Vault";

export default function VaultRoute() {
  return (
    <Suspense fallback={null}>
      <VaultPage />
    </Suspense>
  );
}


