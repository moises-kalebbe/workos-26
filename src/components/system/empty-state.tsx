import { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="surface-card flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/80 bg-background/70">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

