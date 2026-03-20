"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock3, CloudSun } from "lucide-react";
import { usePathname } from "next/navigation";
import { getRouteMeta } from "@/config/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { TopBarCommand } from "@/components/system/top-bar-command";
import { useCurrentWeather } from "@/hooks/use-current-weather";

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function TopBar() {
  const pathname = usePathname() || "/";
  const routeMeta = getRouteMeta(pathname);
  const weather = useCurrentWeather();
  const [clock, setClock] = React.useState(() => formatClock(new Date()));

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(formatClock(new Date()));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-[linear-gradient(180deg,rgba(10,15,28,0.96),rgba(10,15,28,0.88))] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 md:px-6 lg:px-8">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="h-9 w-9 md:hidden" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Area de trabalho</p>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-end md:gap-3">
                <h1 className="truncate text-base font-semibold text-foreground md:text-[1.05rem]">{routeMeta.label}</h1>
                <p className="hidden truncate text-xs text-muted-foreground xl:block">{routeMeta.summary}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-self-end gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/15 bg-white/[0.03] px-3 py-2 text-sm text-foreground shadow-[0_12px_28px_-22px_rgba(34,211,238,0.9)]">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              <span className="font-medium tabular-nums">{clock}</span>
            </div>
            <div
              className="hidden items-center gap-2 rounded-2xl border border-border/60 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground lg:flex"
              aria-live="polite"
            >
              <CloudSun className="h-4 w-4 text-cyan-300" />
              <span className="font-medium text-foreground">Limeira, SP</span>
              <span className="text-border">/</span>
              {weather.loading ? (
                <span>Carregando...</span>
              ) : weather.error ? (
                <span>{weather.summary}</span>
              ) : (
                <span>
                  {weather.temperature}Â°C | {weather.summary}
                </span>
              )}
            </div>

            <TopBarCommand />
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="rounded-2xl border border-border/70 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Exige atencao</p>
            <p className="mt-2 text-sm text-foreground">{routeMeta.attentionLabel}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white/[0.03] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Proxima acao</p>
            <p className="mt-2 text-sm text-foreground">{routeMeta.nextActionLabel}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
              <AlertTriangle className="h-3.5 w-3.5" />
              Risco ou bloqueio
            </div>
            <p className="mt-2 text-sm text-foreground">{routeMeta.riskLabel}</p>
            {routeMeta.primaryActionLabel && routeMeta.primaryActionPath ? (
              <Link
                href={routeMeta.primaryActionPath}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
              >
                {routeMeta.primaryActionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
