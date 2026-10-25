import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrationConsents, type IntegrationClientId, type IntegrationConsent, type IntegrationScope } from "@/db/schema";
import { SCOPE_IDS } from "@/lib/integrations/clients";

export type ScopeMap = Record<IntegrationScope, boolean>;

/** The user's saved choices; null if they've never chosen for this app. */
export async function getConsent(userId: string, clientId: IntegrationClientId) {
  const [row] = await db
    .select()
    .from(integrationConsents)
    .where(and(eq(integrationConsents.userId, userId), eq(integrationConsents.clientId, clientId)));
  return row ?? null;
}

/** What the user explicitly turned on. Nothing is shared by default (no pre-ticked consent). */
export function effectiveScopes(row: Pick<IntegrationConsent, "scopes"> | null): ScopeMap {
  return Object.fromEntries(SCOPE_IDS.map((s) => [s, row?.scopes[s] === true])) as ScopeMap;
}

/** Linked and not revoked: the app may read the profile and receive webhooks. */
export const isLinked = (row: IntegrationConsent | null) => Boolean(row?.linkedAt && !row.revokedAt);

export async function saveConsent(
  userId: string,
  clientId: IntegrationClientId,
  input: { scopes: ScopeMap; hiddenProjects?: string[]; link?: boolean },
) {
  const now = new Date();
  const values = {
    scopes: input.scopes,
    ...(input.hiddenProjects ? { hiddenProjects: input.hiddenProjects } : {}),
    ...(input.link ? { linkedAt: now, revokedAt: null } : {}),
    updatedAt: now,
  };
  await db
    .insert(integrationConsents)
    .values({ userId, clientId, hiddenProjects: [], ...values })
    .onConflictDoUpdate({ target: [integrationConsents.userId, integrationConsents.clientId], set: values });
}

export async function revokeLink(userId: string, clientId: IntegrationClientId) {
  await db
    .update(integrationConsents)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(integrationConsents.userId, userId), eq(integrationConsents.clientId, clientId)));
}
