import { Loader2 } from "lucide-react";

export function LoadingState({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/70">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

