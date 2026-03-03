import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Timer,
  Columns3,
  Calendar,
  Lock,
  BarChart3,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Timer, label: "Time Tracker", path: "/tracker" },
  { icon: Columns3, label: "Kanban", path: "/kanban" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Lock, label: "Cofre", path: "/vault" },
  { icon: BarChart3, label: "Relatórios", path: "/reports" },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card h-screen sticky top-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
            WorkOS
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-l-2 border-primary bg-primary/10 text-brand-text font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings + Logout */}
        <div className="px-3 pb-4 space-y-1 border-t border-border pt-3">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              location.pathname === "/settings"
                ? "border-l-2 border-primary bg-primary/10 text-brand-text font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>

          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 px-3 pt-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 text-[10px] transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
