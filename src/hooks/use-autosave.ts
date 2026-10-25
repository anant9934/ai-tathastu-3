"use client";

import { useCallback, useRef, useState } from "react";

import type { SaveResult } from "@/app/onboarding/actions";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Fire-and-track saves for optimistic UIs: the caller updates local state
 * first, then calls save(). Only the latest call's outcome is reflected, so a
 * slow early response can't overwrite a newer status. retry() resends the
 * last payload.
 */
export function useAutosave<T>(action: (payload: T) => Promise<SaveResult>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const last = useRef<{ payload: T } | null>(null);

  const save = useCallback(
    async (payload: T) => {
      const id = ++seq.current;
      last.current = { payload };
      setStatus("saving");
      let result: SaveResult;
      try {
        result = await action(payload);
      } catch {
        result = { ok: false, error: "You appear to be offline. Your choice wasn't saved." };
      }
      if (id !== seq.current) return result;
      setStatus(result.ok ? "saved" : "error");
      setError(result.ok ? null : result.error);
      return result;
    },
    [action],
  );

  const retry = useCallback(() => {
    if (last.current) void save(last.current.payload);
  }, [save]);

  return { status, error, save, retry };
}
