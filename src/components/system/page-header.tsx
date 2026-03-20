import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3 rounded-3xl border border-border bg-card/90 p-5 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

