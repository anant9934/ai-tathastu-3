"use client";

import { Check, CircleAlert, GitMerge, LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";

import { approveInstitution, mergeInstitution, rejectInstitution } from "@/app/admin/institutions/actions";
import { InstitutionCombobox, type InstitutionValue } from "@/components/onboarding/institution-combobox";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";

type Row = { id: string; name: string; place: string; addedBy: string; addedAt: string; users: number };

/** One pending institution with Approve / Merge into… / Reject. */
export function PendingInstitutionRow({ row }: { row: Row }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"approve" | "merge" | "reject" | null>(null);
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState<InstitutionValue>(null);
  const [error, setError] = useState<string | null>(null);

  function run(kind: "approve" | "merge" | "reject", action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusy(kind);
    start(async () => {
      const result = await action().catch(() => ({ ok: false, error: "That didn't go through. Try again." }));
      if (!result.ok) setError(result.error ?? "That didn't go through.");
      setBusy(null);
    });
  }

  const targetId = target && "id" in target ? target.id : null;
  const spin = (k: typeof busy) => busy === k && <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" />;

  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-4 font-normal">
        <span className="block font-medium">{row.name}</span>
        <span className="block text-muted-foreground">{row.place || "No location"}</span>
      </th>
      <td className="px-4 py-4">
        <span className="block">{row.addedBy}</span>
        <span className="block text-muted-foreground" suppressHydrationWarning>
          {timeAgo(row.addedAt, new Date())}
        </span>
      </td>
      <td className="px-4 py-4 text-right font-mono">{row.users}</td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-9 px-3" disabled={pending} onClick={() => run("approve", () => approveInstitution(row.id))}>
            {spin("approve") || <Check data-icon="inline-start" aria-hidden />}
            Approve<span className="sr-only"> {row.name}</span>
          </Button>
          <Button type="button" variant="outline" className="h-9 px-3" disabled={pending} aria-expanded={merging} onClick={() => setMerging((m) => !m)}>
            <GitMerge data-icon="inline-start" aria-hidden />
            Merge<span className="sr-only"> {row.name}</span>
          </Button>
          <Button type="button" variant="ghost" className="h-9 px-3" disabled={pending} onClick={() => run("reject", () => rejectInstitution(row.id))}>
            {spin("reject") || <X data-icon="inline-start" aria-hidden />}
            Reject<span className="sr-only"> {row.name}</span>
          </Button>
        </div>
        {merging && (
          <div className="mt-3 max-w-md rounded-md border p-3">
            <label htmlFor={`merge-${row.id}`} className="text-sm font-medium">
              Merge into
            </label>
            <InstitutionCombobox id={`merge-${row.id}`} value={target} onChange={setTarget} allowOther={false} />
            <Button
              type="button"
              className="mt-3 h-9 px-3"
              disabled={pending || !targetId}
              onClick={() => targetId && run("merge", () => mergeInstitution(row.id, targetId))}
            >
              {spin("merge")}
              Merge {row.users} {row.users === 1 ? "user" : "users"}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
