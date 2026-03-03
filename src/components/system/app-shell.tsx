import { SideNav } from "@/components/system/side-nav";
import { TopBar } from "@/components/system/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <div className="flex min-h-screen flex-1 flex-col md:pl-0">
        <TopBar />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
