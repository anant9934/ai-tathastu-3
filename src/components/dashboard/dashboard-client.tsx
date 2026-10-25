"use client";

import { Eye, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateWidgetPref } from "@/app/(dashboard)/dashboard/actions";
import type { WidgetId } from "@/lib/dashboard/widgets";

const POLL_MS = 5_000;
const MAX_POLLS = 36; // ~3 minutes

/** While profile_views hasn't been written yet, re-render the page every 5 s. */
export function RefreshUntilReady() {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  useEffect(() => {
    if (polls >= MAX_POLLS) return;
    const t = setTimeout(() => {
      router.refresh();
      setPolls((n) => n + 1);
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [polls, router]);

  return polls >= MAX_POLLS ? (
    <p className="mt-3 text-sm text-muted-foreground">
      This is taking longer than usual. Refresh the page in a few minutes.
    </p>
  ) : null;
}

/** Dismissed widgets, with one-click restore. */
export function HiddenWidgets({ items }: { items: { id: WidgetId; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [restoring, setRestoring] = useState<string | null>(null);

  return (
    <div className="mt-10 border-t pt-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="hidden-widgets"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Eye aria-hidden className="size-4" />
        {items.length} hidden {items.length === 1 ? "widget" : "widgets"}
      </button>
      {open && (
        <ul id="hidden-widgets" className="mt-3 flex flex-wrap gap-2">
          {items.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setRestoring(w.id);
                  startTransition(async () => {
                    await updateWidgetPref({ widgetId: w.id, dismissed: false }).catch(() => null);
                    setRestoring(null);
                  });
                }}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-border-strong px-3 text-sm transition-colors duration-150 hover:border-foreground hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
              >
                {restoring === w.id && <LoaderCircle aria-hidden className="size-3.5 animate-spin" />}
                Show {w.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
