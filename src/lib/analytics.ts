import "server-only";

import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { getCurrentConsents } from "@/lib/consent/store";

export type AnalyticsEvent = "institution_search" | "institution_select" | "search_no_results";

/**
 * Records a product event. It is linked to the user only if they granted
 * `analytics` consent; otherwise it's stored anonymously (no user id, no IP)
 * so search quality can still be measured. Never throws: analytics must not
 * break the request it describes.
 */
export async function logEvent(event: AnalyticsEvent, properties: Record<string, unknown>, userId?: string | null) {
  try {
    const consented = userId ? (await getCurrentConsents(userId)).analytics?.granted === true : false;
    await db.insert(analyticsEvents).values({ event, properties, userId: consented ? userId : null });
  } catch (error) {
    console.warn(`analytics ${event} not recorded`, error);
  }
}
