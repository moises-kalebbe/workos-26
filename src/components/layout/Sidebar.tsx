"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/config/navigation";
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
  const mobileItems = [...DASHBOARD_NAV_ITEMS, SETTINGS_NAV_ITEM];

  async function handleSignOut() {
    await signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <>
      <aside className="hidden h-dvh w-80 shrink-0 flex-col border-r border-border/80 bg-sidebar/90 md:sticky md:top-0 md:flex">
        <div className="border-b border-border/80 px-5 py-5">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <div>
              <p className="text-base font-semibold text-foreground">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">Workspace de produtividade</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modulos</p>
          <div className="space-y-1.5">
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const isActive = isPathActive(pathname, item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    isActive
                      ? "border-primary/45 bg-primary/12 text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    {item.description ? <p className="truncate text-xs text-muted-foreground">{item.description}</p> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="space-y-2 border-t border-border/80 px-3 py-3">
          <Link
            href={SETTINGS_NAV_ITEM.path}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
              isPathActive(pathname, SETTINGS_NAV_ITEM.path)
                ? "border-primary/45 bg-primary/12 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground",
            )}
          >
            <SETTINGS_NAV_ITEM.icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{SETTINGS_NAV_ITEM.label}</p>
              {SETTINGS_NAV_ITEM.description ? <p className="truncate text-xs text-muted-foreground">{SETTINGS_NAV_ITEM.description}</p> : null}
            </div>
          </Link>

          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-card/80 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="font-medium">Sair</span>
          </button>

          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/65 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Plano Free</p>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-screen-sm items-center gap-2 overflow-x-auto px-3 py-2">
          {mobileItems.map((item) => {
            const isActive = isPathActive(pathname, item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex min-h-[44px] min-w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors",
                  isActive
                    ? "border-primary/45 bg-primary/12 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="max-w-[72px] truncate">{item.shortLabel || item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
