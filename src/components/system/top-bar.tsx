"use client";

import React from "react";
import { Clock3, CloudSun } from "lucide-react";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/config/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { TopBarCommand } from "@/components/system/top-bar-command";
import { useCurrentWeather } from "@/hooks/use-current-weather";

function resolveTitle(pathname: string) {
  const allItems = [...DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM];
  const exact = allItems.find((item) => item.path === pathname);
  if (exact) return exact.label;

  const nested = allItems.find((item) => pathname.startsWith(`${item.path}/`) && item.path !== "/");
  if (nested) return nested.label;

  return "Dashboard";
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function TopBar() {
  const pathname = usePathname() || "/";
  const pageTitle = resolveTitle(pathname);
  const weather = useCurrentWeather();
  const [clock, setClock] = React.useState(() => formatClock(new Date()));

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(formatClock(new Date()));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark className="h-8 w-8 md:hidden" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">WorkOS</p>
            <h1 className="truncate text-sm font-semibold text-foreground">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2 text-sm text-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            <span className="font-medium tabular-nums">{clock}</span>
          </div>
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <div
            className="hidden items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground sm:flex"
            aria-live="polite"
          >
            <CloudSun className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Limeira, SP</span>
            <span className="text-muted-foreground/80">|</span>
            {weather.loading ? (
              <span>Carregando...</span>
            ) : weather.error ? (
              <span>{weather.summary}</span>
            ) : (
              <span>
                {weather.temperature}°C | {weather.summary}
              </span>
            )}
          </div>

          <TopBarCommand />
        </div>
      </div>
    </header>
  );
}
