"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/system/app-shell";
import { useAuth } from "@/hooks/useAuth";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isSignedIn, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isSignedIn, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Carregando sessão...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}

