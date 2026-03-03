import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: "brand" | "success" | "warning" | "danger" | "info";
  subtitle?: string;
}

const colorMap = {
  brand: {
    border: "border-l-primary",
    bg: "bg-primary/10",
    text: "text-primary",
    icon: "text-primary",
  },
  success: {
    border: "border-l-success",
    bg: "bg-success-muted",
    text: "text-success",
    icon: "text-success",
  },
  warning: {
    border: "border-l-warning",
    bg: "bg-warning-muted",
    text: "text-warning",
    icon: "text-warning",
  },
  danger: {
    border: "border-l-danger",
    bg: "bg-danger-muted",
    text: "text-danger",
    icon: "text-danger",
  },
  info: {
    border: "border-l-info",
    bg: "bg-info-muted",
    text: "text-info",
    icon: "text-info",
  },
};

export function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/20 border-l-[3px]",
        colors.border
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className={cn("mt-2 font-mono text-2xl font-bold tabular-nums", colors.text)}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", colors.bg)}>
          <Icon className={cn("h-5 w-5", colors.icon)} />
        </div>
      </div>
    </div>
  );
}
