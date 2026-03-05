import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  eyebrow?: string;
  icon?: LucideIcon;
}) {
  return (
    <header
      className={cn(
        "surface-card surface-outline flex flex-col gap-4 rounded-2xl border border-border/80 p-5 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-text">{eyebrow}</p>
        ) : null}

        <div className="flex items-start gap-2.5">
          {Icon ? (
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}

          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground md:text-[15px]">{description}</p> : null}
          </div>
        </div>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
