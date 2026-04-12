import React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card/80 p-5 md:flex-row md:items-center md:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description ? <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">{actions}</div> : null}
    </header>
  );
}

