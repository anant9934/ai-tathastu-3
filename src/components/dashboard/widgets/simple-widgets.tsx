import { ArrowRight, Check, Circle } from "lucide-react";
import Link from "next/link";

import type { CompletenessData } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

// Where to go to finish each step (ids from worker/intelligence/compute.py).
const CHECK_LINKS: Record<string, string> = { github: "/connections" };

export function CompletenessWidget({ data }: { data: CompletenessData }) {
  const remaining = data.checks.filter((c) => !c.done);
  return (
    <div>
      <p className="font-heading text-5xl leading-none">
        {data.percent}
        <span className="ml-0.5 font-sans text-base text-muted-foreground">%</span>
      </p>
      <div
        role="meter"
        aria-label="Profile completeness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={data.percent}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full origin-left bg-foreground" style={{ transform: `scaleX(${data.percent / 100})` }} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {remaining.length} {remaining.length === 1 ? "step" : "steps"} left. Each one sharpens your matches.
      </p>
      <ul className="mt-3 space-y-1.5">
        {data.checks.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-2 text-sm", c.done && "text-muted-foreground line-through")}>
            {c.done ? (
              <Check aria-hidden className="size-3.5 text-success" strokeWidth={3} />
            ) : (
              <Circle aria-hidden className="size-3.5" />
            )}
            {!c.done && CHECK_LINKS[c.id] ? (
              <Link
                href={CHECK_LINKS[c.id]}
                className="inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {c.label}
                <ArrowRight aria-hidden className="size-3" />
              </Link>
            ) : (
              c.label
            )}
            <span className="sr-only">{c.done ? " (done)" : " (to do)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type JobMatch = { title: string; company: string; fit: number; href: string };

/** Ready-state rendering for when Avasar supplies data (Phase 4). */
export function JobMatchesWidget({ data }: { data: { matches?: JobMatch[] } }) {
  return (
    <ul className="divide-y">
      {(data.matches ?? []).slice(0, 4).map((m) => (
        <li key={m.href} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <a href={m.href} className="min-w-0 truncate font-medium hover:text-brand">
            {m.title} <span className="font-normal text-muted-foreground">· {m.company}</span>
          </a>
          <span className="font-mono text-xs">{Math.round(m.fit * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
