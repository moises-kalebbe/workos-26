"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { clearClerkBridge, setClerkBridge } from "@/lib/clerkBridge";

function ClerkBridgeProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = useClerkAuth();

  useEffect(() => {
    setClerkBridge({
      userId: userId ?? null,
      getToken: async () => (await getToken()) ?? null,
    });

    return () => {
      clearClerkBridge();
    };
  }, [getToken, userId]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ClerkBridgeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {children}
            <Toaster />
            <Sonner />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkBridgeProvider>
    </ClerkProvider>
  );
}

