"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-autosave";

export function SaveStatusText({
  status,
  error,
  onRetry,
}: {
  status: SaveStatus;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div role="status" aria-live="polite" className="inline-flex min-h-5 items-center gap-1.5 text-xs font-medium text-slate-500">
      {status === "saving" && (
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-[#FF2A85]" />
          Saving changes…
        </span>
      )}
      {status === "saved" && (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
          <Check aria-hidden="true" className="size-3.5 stroke-[2.5]" />
          All changes saved
        </span>
      )}
      {status === "error" && (
        <span className="inline-flex items-center gap-1.5 text-red-600">
          <CircleAlert aria-hidden="true" className="size-3.5" />
          {error ?? "Couldn't save changes."}
          <button
            type="button"
            onClick={onRetry}
            className="font-bold underline underline-offset-2 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </span>
      )}
    </div>
  );
}
