import { AppShell } from "@/components/system/app-shell";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

