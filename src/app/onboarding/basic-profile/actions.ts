"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { SaveResult } from "@/app/onboarding/actions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { academicWrites, readAcademic, validateAcademic, type AcademicField, type AcademicMode } from "@/lib/academic/validate";
import { requireOnboardingStep } from "@/lib/dal";
import { advanceStepQuery } from "@/lib/onboarding/advance";
import { refreshOnboardingShell } from "@/lib/onboarding/refresh";
import { nextStep, stepHref } from "@/lib/onboarding/steps";
import { userFactWrites } from "@/lib/onboarding/user-facts";

// ─── Step 3: basic profile (student) ────────────────────────────────────────

export type BasicProfileField = AcademicField | "fullName";
export type BasicProfileValues = Record<string, string>;
export type BasicProfileFormState = {
  values: BasicProfileValues;
  errors?: Partial<Record<BasicProfileField, string>>;
  formError?: string;
};

const STUDENT: AcademicMode = { year: true, graduation: "expected" };
const name = z.string().trim().max(120, "Keep this under 120 characters.").transform((s) => s.replace(/\s+/g, " "));

/** Draft autosave on blur, for the name only (everything else is a pick from a list). */
export async function saveProfileDraft(field: "fullName", value: string): Promise<SaveResult> {
  const { user } = await requireOnboardingStep("basic_profile");
  if (field !== "fullName") return { ok: false, error: "Not saved." };
  const parsed = name.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Not saved yet. Check this field." };
  await db.update(users).set({ name: parsed.data || null, updatedAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true };
}

/** Validates the academic block against the catalogue (src/lib/academic/validate.ts), saves, advances. */
export async function submitBasicProfile(_prev: BasicProfileFormState, formData: FormData): Promise<BasicProfileFormState> {
  const { user, state } = await requireOnboardingStep("basic_profile");
  const raw = { ...readAcademic(formData), fullName: String(formData.get("fullName") ?? "").trim() };

  const fullName = name.safeParse(raw.fullName);
  const { errors, value } = await validateAcademic(raw, user.id, STUDENT);
  const allErrors: BasicProfileFormState["errors"] = { ...errors };
  if (!fullName.success || !fullName.data) allErrors.fullName = fullName.success ? "Enter your full name." : fullName.error.issues[0].message;
  if (Object.keys(allErrors).length || !value || !fullName.success) return { values: raw, errors: allErrors };

  try {
    const { set, facts } = await academicWrites(user.id, value, STUDENT);
    await db.batch([
      advanceStepQuery(user, state, "basic_profile"),
      db.update(users).set({ ...set, name: fullName.data, updatedAt: new Date() }).where(eq(users.id, user.id)),
      ...(await userFactWrites(user.id, [{ group: "identity", field: "full_name", value: fullName.data }, ...facts])),
    ]);
  } catch (error) {
    console.error("submitBasicProfile failed", error);
    return { values: raw, formError: "We couldn't save your profile. Check your connection and try again." };
  }

  refreshOnboardingShell();
  redirect(stepHref(nextStep("basic_profile", user.role)));
}
