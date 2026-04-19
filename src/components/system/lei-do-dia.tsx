"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Swords } from "lucide-react";
import { getLeiDoDia } from "@/lib/leis-do-poder";
import { cn } from "@/lib/utils";

export function LeiDoDia({ now }: { now: Date }) {
  const [expanded, setExpanded] = useState(false);
  const lei = getLeiDoDia(now);

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
      <button
        className="w-full text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Swords className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-primary">
                Lei do Dia
              </p>
              <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-caption font-semibold text-muted-foreground">
                #{lei.number}
              </span>
            </div>

            <h3 className="mt-1.5 text-base font-semibold text-foreground">{lei.title}</h3>
            <p className="mt-1 text-sm italic text-muted-foreground">"{lei.keyPhrase}"</p>
          </div>

          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <p className="text-sm text-muted-foreground">{lei.summary}</p>
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-eyebrow font-semibold uppercase tracking-label text-primary mb-1">
              Aplicar hoje
            </p>
            <p className="text-sm text-foreground">{lei.applicationHint}</p>
          </div>
        </div>
      )}
    </section>
  );
}
