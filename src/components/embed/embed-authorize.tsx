"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Approve/deny step; the result is posted to the opener, to exactly `origin`. */
export function EmbedAuthorize({ origin }: { origin: string }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const host = new URL(origin).host;

  function reply(message: Record<string, unknown>) {
    window.opener?.postMessage({ source: "ait-embed", ...message }, origin);
    window.close();
  }

  async function allow() {
    setState("working");
    try {
      const res = await fetch(`/api/auth/embed-token?origin=${encodeURIComponent(origin)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const { token, expiresAt } = await res.json();
      reply({ type: "token", token, expiresAt });
    } catch {
      setState("error");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <ShieldCheck aria-hidden className="size-6 text-brand" />
      <h1 className="mt-4 font-heading text-3xl leading-tight">Show your profile on {host}?</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {host} will see your name, interview-readiness score and top three skills for the next 15 minutes. Nothing
        else, and nothing it can change.
      </p>
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Couldn&apos;t create access. Try again.
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <Button className="h-10 px-5" onClick={allow} disabled={state === "working"}>
          {state === "working" && <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" />}
          Allow
        </Button>
        <Button variant="ghost" className="h-10 px-4" onClick={() => reply({ type: "denied" })} disabled={state === "working"}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
