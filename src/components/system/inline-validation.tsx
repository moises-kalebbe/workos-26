import { cn } from "@/lib/utils";

export function InlineValidation({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return <p className={cn("text-xs text-danger", className)}>{message}</p>;
}

