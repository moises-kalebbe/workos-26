import { SideNav } from "@/components/system/side-nav";
import { TopBar } from "@/components/system/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen max-w-full overflow-x-hidden bg-background">
      <SideNav />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
          <div className="mx-auto min-w-0 max-w-7xl px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
