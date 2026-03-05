import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-[#0B1220] shadow-[0_14px_28px_-22px_rgba(59,130,246,0.8)]",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(59,130,246,0.36),transparent_48%),radial-gradient(circle_at_82%_86%,rgba(249,115,22,0.28),transparent_46%)]" />
      <svg viewBox="0 0 64 64" className="relative h-4 w-4">
        <path
          d="M14 18H22L27 37L32 24H36L41 37L46 18H54L48 46H41L34 29L27 46H20L14 18Z"
          fill="#DBEAFE"
        />
      </svg>
    </span>
  );
}
