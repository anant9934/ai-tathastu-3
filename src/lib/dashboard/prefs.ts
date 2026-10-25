import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { widgetPrefs } from "@/db/schema";
import { WIDGET_IDS, type WidgetId } from "@/lib/dashboard/widgets";

export const widgetPrefSchema = z
  .object({
    widgetId: z.enum(WIDGET_IDS as [WidgetId, ...WidgetId[]]),
    dismissed: z.boolean().optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => v.dismissed !== undefined || v.pinned !== undefined, "Nothing to update");

export type WidgetPrefInput = z.infer<typeof widgetPrefSchema>;

export function getWidgetPrefs(userId: string) {
  return db.select().from(widgetPrefs).where(eq(widgetPrefs.userId, userId));
}

/** Upserts only the fields given. Dismissing unpins, so a hidden widget can't hold the top slot. */
export async function setWidgetPref(userId: string, input: WidgetPrefInput) {
  const patch = {
    ...(input.dismissed !== undefined && { dismissed: input.dismissed }),
    ...(input.pinned !== undefined && { pinned: input.pinned }),
    ...(input.dismissed === true && { pinned: false }),
    updatedAt: new Date(),
  };
  await db
    .insert(widgetPrefs)
    .values({ userId, widgetId: input.widgetId, dismissed: false, pinned: false, ...patch })
    .onConflictDoUpdate({ target: [widgetPrefs.userId, widgetPrefs.widgetId], set: patch });
}
