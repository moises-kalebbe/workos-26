import { cn } from "@/lib/utils";

export function FilterBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "surface-card flex flex-wrap items-center gap-2 rounded-xl border border-border/80 p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

