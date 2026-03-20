import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

export function StatePanel({
  state,
  icon: Icon,
  title,
  description,
  bullets = [],
  action,
  secondaryAction,
  className,
}: {
  state: "loading" | "empty" | "error";
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  if (state === "loading") {
    return (
      <div className={cn("rounded-3xl border border-border bg-card/90 p-5 md:p-6", className)}>
        <div className="mb-4 max-w-2xl">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className={cn("rounded-3xl border border-dashed border-border bg-card/90 p-6 md:p-7", className)}>
      <div className="max-w-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {bullets.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {bullets.map((bullet) => (
              <span key={bullet} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                {bullet}
              </span>
            ))}
          </div>
        ) : null}
        {(action || secondaryAction) ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StatePanelAction({
  children,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button {...props} variant={variant} className={cn("rounded-2xl", props.className)}>
      {children}
    </Button>
  );
}
