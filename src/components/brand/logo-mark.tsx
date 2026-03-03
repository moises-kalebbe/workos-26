import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-[#061022] shadow-[0_10px_30px_-18px_rgba(34,211,238,0.85)]",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(34,211,238,0.34),transparent_48%),radial-gradient(circle_at_82%_86%,rgba(59,130,246,0.3),transparent_46%)]" />
      <svg viewBox="0 0 64 64" className="relative h-4 w-4">
        <path
          d="M14 18H22L27 37L32 24H36L41 37L46 18H54L48 46H41L34 29L27 46H20L14 18Z"
          fill="#A5F3FC"
        />
      </svg>
    </span>
  );
}
