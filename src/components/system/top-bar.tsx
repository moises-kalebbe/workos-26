"use client";

import { Bell, Command } from "lucide-react";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";

function resolveTitle(pathname: string) {
  const allItems = [...DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM];
  const exact = allItems.find((item) => item.path === pathname);
  if (exact) return exact.label;

  const nested = allItems.find((item) => pathname.startsWith(`${item.path}/`) && item.path !== "/");
  if (nested) return nested.label;

  return "Dashboard";
}

export function TopBar() {
  const pathname = usePathname() || "/";
  const pageTitle = resolveTitle(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 w-8 md:hidden" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">WorkOS</p>
            <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Command className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

