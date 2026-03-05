"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Command, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";

function resolveContext(pathname: string) {
  const allItems = [...DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM];
  const exact = allItems.find((item) => item.path === pathname);
  if (exact) {
    return {
      title: exact.label,
      description: exact.description,
    };
  }

  const nested = allItems.find((item) => pathname.startsWith(`${item.path}/`) && item.path !== "/");
  if (nested) {
    return {
      title: nested.label,
      description: nested.description,
    };
  }

  return {
    title: "Dashboard",
    description: "Visao executiva e prioridades do dia",
  };
}

export function TopBar() {
  const pathname = usePathname() || "/";
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const { title, description } = resolveContext(pathname);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(now),
    [now],
  );
  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(now),
    [now],
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 w-8 md:hidden" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-text">Painel</p>
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center rounded-lg border border-border/80 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
            <span className="capitalize">{dateLabel}</span>
            <span className="mx-2 text-border">|</span>
            <span className="font-mono tabular-nums">{timeLabel}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 gap-2 border-border/80 bg-card/70 text-muted-foreground md:inline-flex"
          >
            <Command className="h-4 w-4" />
            Busca rapida
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
