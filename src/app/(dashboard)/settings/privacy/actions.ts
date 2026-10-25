"use server";

import type { SaveResult } from "@/app/onboarding/actions";
import { appendConsents, consentChoicesSchema } from "@/lib/consent/store";
import { requireOnboardedUser } from "@/lib/dal";

/** Autosaved toggles after onboarding. Append-only, like the review step: unchanged answers add no rows. */
export async function savePrivacyConsents(input: unknown): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const parsed = consentChoicesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That choice wasn't valid. Refresh and try again." };
  // mentor_discovery applies to students only; faculty and alumni are always findable.
  await appendConsents(user.id, { ...parsed.data, mentor_discovery: user.role === "student" && parsed.data.mentor_discovery });
  return { ok: true };
}
