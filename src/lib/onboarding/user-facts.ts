import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/db";
import { profileFacts } from "@/db/schema";

export type UserFact = { group: string; field: string; value: string | null; recordKey?: string };

/**
 * Batch writes that record what the user typed as confirmed `user_entered`
 * facts. A changed value gets a new row and the old row points at it via
 * superseded_by (history is never overwritten); unchanged values write nothing.
 * Facts are matched on group + field + record key, so a fixed record key
 * (e.g. "alumni:current-role") keeps one current entry per answer.
 */
export async function userFactWrites(userId: string, facts: UserFact[]): Promise<BatchItem<"pg">[]> {
  const groups = [...new Set(facts.map((f) => f.group))];
  const current = (
    await Promise.all(
      groups.map((group) =>
        db
          .select({
            id: profileFacts.id,
            group: profileFacts.fieldGroup,
            field: profileFacts.fieldName,
            recordKey: profileFacts.recordKey,
            value: profileFacts.normalizedValue,
            confirmation: profileFacts.confirmation,
          })
          .from(profileFacts)
          .where(
            and(
              eq(profileFacts.userId, userId),
              eq(profileFacts.fieldGroup, group),
              eq(profileFacts.origin, "user_entered"),
              isNull(profileFacts.supersededBy),
            ),
          ),
      ),
    )
  ).flat();

  const writes: BatchItem<"pg">[] = [];
  for (const fact of facts) {
    const prev = current.find(
      (c) => c.group === fact.group && c.field === fact.field && (c.recordKey ?? null) === (fact.recordKey ?? null),
    );
    if (prev && prev.value === fact.value) {
      // Entered again after being withdrawn: it counts again.
      if (prev.confirmation === "rejected") {
        writes.push(db.update(profileFacts).set({ confirmation: "confirmed" }).where(eq(profileFacts.id, prev.id)));
      }
      continue;
    }
    if (!prev && fact.value === null) continue;

    const id = crypto.randomUUID();
    writes.push(
      db.insert(profileFacts).values({
        id,
        userId,
        fieldGroup: fact.group,
        fieldName: fact.field,
        recordKey: fact.recordKey ?? null,
        extractedValue: fact.value,
        normalizedValue: fact.value,
        extractionMethod: "user_entered",
        origin: "user_entered",
        confidence: 1,
        validationStatus: "validated",
        confirmation: "confirmed",
      }),
    );
    if (prev) writes.push(db.update(profileFacts).set({ supersededBy: id }).where(eq(profileFacts.id, prev.id)));
  }
  return writes;
}
