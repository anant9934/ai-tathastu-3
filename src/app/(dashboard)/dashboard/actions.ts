"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";

import type { SaveResult } from "@/app/onboarding/actions";
import { db } from "@/db";
import { connections, jobs } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { setWidgetPref, widgetPrefSchema, type WidgetPrefInput } from "@/lib/dashboard/prefs";
import { wakeWorker } from "@/lib/worker-ping";

/** Dismiss / restore / pin / unpin a widget, then re-render the dashboard. */
export async function updateWidgetPref(input: WidgetPrefInput): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const parsed = widgetPrefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown widget." };
  await setWidgetPref(user.id, parsed.data);
  refresh();
  return { ok: true };
}

/** "Refresh" on a stale GitHub widget: queues a new sync for the user's connection. */
export async function refreshGithub(): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const [connection] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.userId, user.id), eq(connections.sourceId, "github")));
  if (!connection) return { ok: false, error: "GitHub isn't connected." };
  await db
    .insert(jobs)
    .values({
      type: "connector_sync",
      userId: user.id,
      idempotencyKey: `connector_sync:${connection.id}:manual:${randomUUID()}`,
      payload: { source_id: "github", connection_id: connection.id },
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey });
  wakeWorker("connector_sync:github:manual");
  refresh();
  return { ok: true };
}
