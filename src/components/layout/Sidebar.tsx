"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS, NAV_GROUP_LABELS, SETTINGS_NAV_ITEM, type NavGroup } from "@/config/navigation";
import { APP_NAME } from "@/content/labels";
import { LogoMark } from "@/components/brand/logo-mark";

function isPathActive(pathname: string, itemPath: string) {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function Sidebar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { signOut, user } = useAuth();

  const groupedItems = DASHBOARD_NAV_ITEMS.reduce(
    (acc, item) => {
      acc[item.group].push(item);
      return acc;
    },
    { today: [], base: [], system: [] } as Record<NavGroup, typeof DASHBOARD_NAV_ITEMS>,
  );

  async function handleSignOut() {
    await signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <>
      <aside className="hidden h-screen w-80 flex-col border-r border-border/80 bg-card/70 md:flex md:sticky md:top-0">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="bg-gradient-to-r from-cyan-300 to-sky-500 bg-clip-text text-lg font-bold text-transparent">
              {APP_NAME}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Cockpit diario para decidir o proximo passo, executar com foco e recuperar contexto rapido.
          </p>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {(["today", "base"] as NavGroup[]).map((group) => (
            <div key={group} className="space-y-2">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {NAV_GROUP_LABELS[group]}
              </p>
              <div className="space-y-1">
                {groupedItems[group]
                  .sort((a, b) => a.priority - b.priority)
                  .map((item) => {
                    const isActive = isPathActive(pathname, item.path);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={cn(
                          "block rounded-2xl border px-3 py-2.5 transition-colors",
                          isActive
                            ? "border-primary/30 bg-primary/15 text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <p className={cn("mt-1 pl-7 text-[11px] leading-4", isActive ? "text-slate-300" : "text-muted-foreground")}>
                          {item.summary}
                        </p>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-border px-3 pb-4 pt-3">
          <Link
            href={SETTINGS_NAV_ITEM.path}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
              isPathActive(pathname, SETTINGS_NAV_ITEM.path)
                ? "border border-primary/30 bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <SETTINGS_NAV_ITEM.icon className="h-4 w-4" />
            {SETTINGS_NAV_ITEM.label}
          </Link>

          <button
            onClick={() => {
              void handleSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>

          <div className="rounded-2xl border border-border/70 bg-background/30 px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{user?.email}</p>
                <p className="text-[10px] text-muted-foreground">Plano Free</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          {DASHBOARD_NAV_ITEMS.filter((item) => item.group === "today").map((item) => {
            const isActive = isPathActive(pathname, item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex min-w-[72px] shrink-0 flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {(item.shortLabel || item.label).split(" ")[0]}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
