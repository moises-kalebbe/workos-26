"use client";

import { ClerkProvider, useAuth as useClerkAuth, useClerk, useUser } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthContext, type AuthContextType } from "@/hooks/useAuth";
import { clearClerkBridge, setClerkBridge } from "@/lib/clerkBridge";

const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;
const DEV_AUTH_EMAIL = process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL || "dev@localhost";

function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useClerkAuth();
  const { user, isLoaded } = useUser();
  const { signOut, session } = useClerk();

  useEffect(() => {
    setClerkBridge({
      userId: userId ?? null,
      getToken: async () => (await getToken()) ?? null,
    });

    return () => {
      clearClerkBridge();
    };
  }, [getToken, userId]);

  const value = useMemo<AuthContextType>(() => ({
    user: (user as AuthContextType["user"]) ?? null,
    loading: !isLoaded,
    isSignedIn: !!user,
    getToken: async (options) => (await session?.getToken(options)) ?? null,
    signOut: async () => {
      await signOut();
    },
  }), [isLoaded, session, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function DevAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setClerkBridge({
      userId: DEV_AUTH_USER_ID,
      getToken: async () => null,
    });

    return () => {
      clearClerkBridge();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user: DEV_AUTH_USER_ID ? {
      id: DEV_AUTH_USER_ID,
      primaryEmailAddress: {
        emailAddress: DEV_AUTH_EMAIL,
      },
    } : null,
    loading: false,
    isSignedIn: true,
    getToken: async () => null,
    signOut: async () => {},
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const appTree = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );

  if (DEV_AUTH_USER_ID) {
    return <DevAuthProvider>{appTree}</DevAuthProvider>;
  }

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ClerkAuthProvider>{appTree}</ClerkAuthProvider>
    </ClerkProvider>
  );
}

