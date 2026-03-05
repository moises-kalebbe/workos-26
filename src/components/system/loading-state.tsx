import { Loader2 } from "lucide-react";

export function LoadingState({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="surface-card flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-border/80">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/70">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

