import { cn } from "@/lib/utils";

type HeroStat = {
  label: string;
  value: string;
  tone?: "default" | "info" | "success" | "warning" | "danger";
};

function resolveTone(tone: HeroStat["tone"]) {
  switch (tone) {
    case "info":
      return "text-cyan-300";
    case "success":
      return "text-emerald-300";
    case "warning":
      return "text-amber-300";
    case "danger":
      return "text-rose-300";
    default:
      return "text-foreground";
  }
}

export function OperationalHero({
  eyebrow,
  title,
  description,
  focusLabel,
  focusValue,
  riskLabel,
  riskValue,
  action,
  stats = [],
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  focusLabel: string;
  focusValue: string;
  riskLabel: string;
  riskValue: string;
  action?: React.ReactNode;
  stats?: HeroStat[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-primary/20 bg-[linear-gradient(135deg,rgba(8,18,38,0.98),rgba(15,25,44,0.94))] p-5 shadow-[0_24px_60px_-44px_rgba(34,211,238,0.45)] md:p-6",
        className,
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{eyebrow}</p>
          ) : null}
          <h1 className="mt-2 text-2xl font-semibold text-foreground md:text-[2rem]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>

          {stats.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
                  <p className={cn("mt-2 text-xl font-semibold", resolveTone(stat.tone))}>{stat.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 self-start">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">{focusLabel}</p>
            <p className="mt-2 text-sm font-medium leading-6 text-foreground">{focusValue}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">{riskLabel}</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-300">{riskValue}</p>
          </div>
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
