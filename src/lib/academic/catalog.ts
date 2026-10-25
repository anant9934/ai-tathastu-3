import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { degrees, institutions, specializations, type Institution } from "@/db/schema";
import { rankByName } from "@/lib/academic/match";

// The catalogue changes only by migration or `npm run db:seed:academic`, so a
// short in-process cache saves a query per keystroke.
const TTL_MS = 5 * 60_000;
let cache: { at: number; rows: Institution[] } | null = null;

/** After an admin approves or merges (this instance only; others refresh within the TTL). */
export const clearInstitutionCache = () => {
  cache = null;
};

export async function verifiedInstitutions(): Promise<Institution[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = await db
    .select()
    .from(institutions)
    .where(eq(institutions.verificationStatus, "verified"))
    .orderBy(asc(institutions.canonicalName));
  cache = { at: Date.now(), rows };
  return rows;
}

export type InstitutionOption = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  countryCode: string | null;
};

export const toOption = (i: Institution): InstitutionOption => ({
  id: i.id,
  name: i.canonicalName,
  city: i.city,
  state: i.state,
  countryCode: i.countryCode,
});

export async function searchInstitutions(query: string, limit = 8) {
  return rankByName(query, await verifiedInstitutions(), limit).map(toOption);
}

/** A verified institution, or the caller's own pending one ("Other / Not listed"). */
export async function institutionForUser(id: string, userId: string) {
  const [row] = await db.select().from(institutions).where(eq(institutions.id, id));
  if (!row) return null;
  if (row.verificationStatus === "verified" || (row.verificationStatus === "pending" && row.createdBy === userId)) return row;
  return null;
}

export async function degreeCatalog() {
  const [d, s] = await Promise.all([
    db.select().from(degrees).orderBy(asc(degrees.sortOrder)),
    db.select().from(specializations).orderBy(asc(specializations.sortOrder)),
  ]);
  return {
    degrees: d.map((x) => ({ id: x.id, canonicalName: x.canonicalName, aliases: x.aliases, level: x.level, durationYears: x.durationYears })),
    specializations: s.map((x) => ({ id: x.id, canonicalName: x.canonicalName, aliases: x.aliases, applicableDegreeIds: x.applicableDegreeIds })),
  };
}

export type DegreeCatalog = Awaited<ReturnType<typeof degreeCatalog>>;

/** Pending institution typed by this user; reused if they submit the same name again. */
export async function pendingInstitutionFor(userId: string, input: { name: string; city: string; state: string | null; countryCode: string | null }) {
  const mine = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.createdBy, userId), eq(institutions.verificationStatus, "pending")));
  const same = mine.find((m) => m.canonicalName.trim().toLowerCase() === input.name.trim().toLowerCase());
  if (same) {
    await db.update(institutions).set({ city: input.city, state: input.state, countryCode: input.countryCode }).where(eq(institutions.id, same.id));
    return same.id;
  }
  const [row] = await db
    .insert(institutions)
    .values({
      canonicalName: input.name,
      city: input.city,
      state: input.state,
      countryCode: input.countryCode,
      verificationStatus: "pending",
      source: "user",
      createdBy: userId,
    })
    .returning({ id: institutions.id });
  return row.id;
}
