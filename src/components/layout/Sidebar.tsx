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

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <>
      <aside className="hidden h-screen w-72 flex-col border-r border-border/80 bg-card/70 md:flex md:sticky md:top-0">
        <div className="flex items-center gap-3 px-5 py-5">
          <LogoMark />
          <span className="bg-gradient-to-r from-cyan-300 to-sky-500 bg-clip-text text-lg font-bold text-transparent">
            {APP_NAME}
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isActive = isPathActive(pathname, item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border border-primary/30 bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border px-3 pb-4 pt-3">
          <Link
            href={SETTINGS_NAV_ITEM.path}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
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
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>

          <div className="flex items-center gap-3 px-3 pt-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
              <p className="text-[10px] text-muted-foreground">Plano Free</p>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isActive = isPathActive(pathname, item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors",
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

