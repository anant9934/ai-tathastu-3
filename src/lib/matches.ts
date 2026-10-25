import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { consents, institutions, matches, onboardingState, users } from "@/db/schema";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";

export type MatchCard = {
  studentId: string;
  name: string;
  role: string | null;
  university: string | null;
  score: number;
  reasons: string[];
};

/**
 * A mentor's (faculty or alum) matched students, best first. Only students
 * whose latest `mentor_discovery` consent is granted are returned; the rest
 * are counted, never shown.
 */
export async function matchesForMentor(mentorId: string, limit = 5): Promise<{ visible: MatchCard[]; hidden: number }> {
  const rows = await db
    .select({
      studentId: matches.studentId,
      score: matches.score,
      reasons: matches.reasons,
      name: users.name,
      university: institutions.canonicalName,
      legacyUniversity: users.university,
      role: onboardingState.careerRole,
    })
    .from(matches)
    .innerJoin(users, eq(users.id, matches.studentId))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(onboardingState, eq(onboardingState.userId, users.id))
    .where(eq(matches.mentorId, mentorId))
    .orderBy(desc(matches.score));
  if (!rows.length) return { visible: [], hidden: 0 };

  const decisions = await db
    .select({ userId: consents.userId, granted: consents.granted })
    .from(consents)
    .where(and(eq(consents.purpose, "mentor_discovery"), inArray(consents.userId, rows.map((r) => r.studentId))))
    .orderBy(desc(consents.createdAt));
  const latest = new Map<string, boolean>();
  for (const d of decisions) if (!latest.has(d.userId)) latest.set(d.userId, d.granted === true);

  const discoverable = rows.filter((r) => latest.get(r.studentId) === true);
  return {
    visible: discoverable.slice(0, limit).map((r) => ({
      studentId: r.studentId,
      name: r.name ?? "A student",
      role: CAREER_ROLES.find((c) => c.id === r.role)?.label ?? null,
      university: r.university ?? r.legacyUniversity,
      score: r.score,
      reasons: r.reasons.slice(0, 2),
    })),
    hidden: rows.length - discoverable.length,
  };
}
