import { Lock } from "lucide-react";
import Link from "next/link";

import type { WidgetDefinition } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

export function WidgetSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Loading {label}…</span>
      <div aria-hidden className="animate-pulse space-y-3">
        <div className="h-10 w-1/3 rounded-md bg-muted" />
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-3 w-4/5 rounded-full bg-muted" />
        <div className="h-3 w-3/5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function WidgetEmpty({ def }: { def: WidgetDefinition }) {
  const action = def.empty.action;
  return (
    <div className="flex h-full flex-col items-start">
      <p className="font-medium text-pretty">{def.empty.title}</p>
      <p className="mt-1 mb-4 text-sm leading-relaxed text-muted-foreground">{def.empty.body}</p>
      {action &&
        (action.disabled ? (
          <button
            type="button"
            disabled
            className="mt-auto inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-border-strong px-3 text-sm text-muted-foreground"
          >
            <Lock aria-hidden className="size-3.5" />
            {action.label}
            <span className="font-mono text-[0.6875rem] tracking-wider uppercase">· Coming soon</span>
          </button>
        ) : (
          <Link
            href={action.href}
            className={cn(
              "mt-auto inline-flex h-9 items-center rounded-md border border-foreground px-3 text-sm font-medium transition-colors duration-150",
              "hover:bg-foreground hover:text-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            )}
          >
            {action.label}
          </Link>
        ))}
    </div>
  );
}
