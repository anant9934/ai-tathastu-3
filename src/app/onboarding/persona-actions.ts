"use server";

import { and, eq, isNull, like, notInArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { SaveResult } from "@/app/onboarding/actions";
import { db } from "@/db";
import { onboardingState, PERSONAS, profileFacts, users, type Persona } from "@/db/schema";
import { requireOnboardingStep, requireRoleChoice } from "@/lib/dal";
import { advanceStepQuery } from "@/lib/onboarding/advance";
import { refreshOnboardingShell } from "@/lib/onboarding/refresh";
import { CAREER_ROLE_IDS } from "@/lib/onboarding/catalog";
import { readForm, schemaFor, type PersonaFormState, type PersonaFormStep } from "@/lib/onboarding/personas";
import { firstStep, FLOWS, nextStep, stepHref, type WizardStep } from "@/lib/onboarding/steps";
import { userFactWrites, type UserFact } from "@/lib/onboarding/user-facts";
import { academicWrites, readAcademic, validateAcademic, type AcademicMode } from "@/lib/academic/validate";

// ─── Step 0: persona ────────────────────────────────────────────────────────

/**
 * Saves the persona and starts its flow. Choosing the same persona again
 * resumes where the user left off; switching persona restarts at the new
 * flow's first step (its questions differ), keeping anything already saved.
 */
export async function choosePersona(formData: FormData) {
  const { user, state } = await requireRoleChoice();
  const parsed = z.enum(PERSONAS).safeParse(formData.get("persona"));
  if (!parsed.success) redirect("/onboarding/role");
  const persona = parsed.data;

  const resume =
    persona === user.role && state.currentStep !== "role" && FLOWS[persona].includes(state.currentStep as WizardStep);
  const step = resume ? (state.currentStep as WizardStep) : firstStep(persona);
  await db.batch([
    db.update(users).set({ role: persona, updatedAt: new Date() }).where(eq(users.id, user.id)),
    db.update(onboardingState).set({ currentStep: step, updatedAt: new Date() }).where(eq(onboardingState.userId, user.id)),
  ]);
  refreshOnboardingShell();
  redirect(stepHref(step));
}

// ─── Form steps (faculty and alumni) ────────────────────────────────────────

type Values = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Per step: the persona it belongs to, and what it writes (users columns, onboarding_state, facts). */
const WRITERS: Record<
  Exclude<PersonaFormStep, "faculty_profile" | "alumni_profile">,
  { persona: Persona; users?: (v: Values) => Partial<typeof users.$inferInsert>; state?: (v: Values) => Partial<typeof onboardingState.$inferInsert>; facts?: (v: Values) => UserFact[] }
> = {
  mentorship: {
    persona: "faculty",
    state: (v) => ({ mentorship: { capacity: Number(v.capacity), canVerifyEris: v.canVerifyEris === true, canReviewResumes: v.canReviewResumes === true } }),
  },
  professional_profile: {
    persona: "alumni",
    users: (v) => ({ company: str(v.company), jobTitle: str(v.jobTitle) }),
    // The closest career area drives role affinity and matching, like a student's direction.
    state: (v) => ({ careerRole: str(v.careerArea), careerRoles: v.careerArea ? [v.careerArea as string] : [] }),
    facts: (v) => [
      { group: "identity", field: "headline", value: `${v.jobTitle} at ${v.company}` },
      { group: "experience", field: "organization", value: str(v.company), recordKey: "alumni:current-role" },
      { group: "experience", field: "role", value: str(v.jobTitle), recordKey: "alumni:current-role" },
      { group: "experience", field: "end_date", value: "Present", recordKey: "alumni:current-role" },
    ],
  },
  give_back: {
    persona: "alumni",
    state: (v) => ({ giveBack: { mentor: v.mentor === true, refer: v.refer === true, speak: v.speak === true } }),
  },
};

/** Shared submit for the faculty and alumni form steps: validate, save, advance. */
async function submitPersonaStep(step: keyof typeof WRITERS, formData: FormData): Promise<PersonaFormState> {
  const { user, state } = await requireOnboardingStep(step as WizardStep);
  const writer = WRITERS[step];
  const raw = readForm(step, formData);
  if (user.role !== writer.persona) redirect(stepHref(state.currentStep));

  const parsed = schemaFor(step).safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { values: raw, errors };
  }
  const v = parsed.data as Values;

  try {
    const userValues = writer.users?.(v);
    const stateValues = writer.state?.(v);
    // One batch (a transaction on Neon): the answers and the step advance land together.
    const writes: BatchItem<"pg">[] = [
      ...(userValues ? [db.update(users).set({ ...userValues, updatedAt: new Date() }).where(eq(users.id, user.id))] : []),
      ...(stateValues ? [db.update(onboardingState).set({ ...stateValues, updatedAt: new Date() }).where(eq(onboardingState.userId, user.id))] : []),
      ...(writer.facts ? await userFactWrites(user.id, writer.facts(v)) : []),
    ];
    await db.batch([advanceStepQuery(user, state, step as WizardStep), ...writes]);
  } catch (error) {
    console.error(`${step} failed`, error);
    return { values: raw, formError: "We couldn't save this. Check your connection and try again." };
  }
  refreshOnboardingShell();
  redirect(stepHref(nextStep(step as WizardStep, user.role)));
}

// ─── Step 1 for faculty and alumni: the shared academic block + persona fields ─

const FACULTY: AcademicMode = { year: false, graduation: null };
const ALUMNI: AcademicMode = { year: false, graduation: "completed" };
const fullNameSchema = z.string().trim().max(120, "Keep this under 120 characters.").transform((v) => v.replace(/\s+/g, " "));

/**
 * Same institution/degree/specialization validation as students
 * (src/lib/academic/validate.ts), plus the persona's own fields.
 */
async function submitAcademicPersonaStep(step: "faculty_profile" | "alumni_profile", formData: FormData): Promise<PersonaFormState> {
  const { user, state } = await requireOnboardingStep(step);
  const persona = step === "faculty_profile" ? "faculty" : "alumni";
  if (user.role !== persona) redirect(stepHref(state.currentStep));
  const mode = persona === "faculty" ? FACULTY : ALUMNI;

  const raw = { ...readAcademic(formData), ...readForm(step, formData), fullName: String(formData.get("fullName") ?? "").trim() };
  const name = fullNameSchema.safeParse(raw.fullName);
  const extras = schemaFor(step).safeParse(raw);
  const { errors, value } = await validateAcademic(raw, user.id, mode);
  const allErrors: Record<string, string> = { ...(errors as Record<string, string>) };
  if (!name.success || !name.data) allErrors.fullName = name.success ? "Full name is required." : name.error.issues[0].message;
  if (!extras.success) for (const issue of extras.error.issues) allErrors[String(issue.path[0])] ??= issue.message;
  if (Object.keys(allErrors).length || !value || !name.success || !extras.success) return { values: raw, errors: allErrors };

  const v = extras.data as Values;
  try {
    const { set, facts } = await academicWrites(user.id, value, mode);
    const personaFacts: UserFact[] =
      persona === "faculty"
        ? [
            { group: "identity", field: "headline", value: [v.academicTitle, v.department, value.institution.name].filter(Boolean).join(", ") },
            { group: "experience", field: "organization", value: value.institution.name, recordKey: "faculty:position" },
            { group: "experience", field: "role", value: [v.academicTitle, v.department].filter(Boolean).join(", "), recordKey: "faculty:position" },
            { group: "experience", field: "end_date", value: "Present", recordKey: "faculty:position" },
          ]
        : [
            { group: "education", field: "institution", value: value.institution.name, recordKey: "alumni:degree" },
            { group: "education", field: "degree", value: value.degree.name, recordKey: "alumni:degree" },
            { group: "education", field: "field_of_study", value: value.specialization.name, recordKey: "alumni:degree" },
            { group: "education", field: "end_date", value: String(value.graduationYear), recordKey: "alumni:degree" },
          ];
    await db.batch([
      advanceStepQuery(user, state, step),
      db
        .update(users)
        .set({
          ...set,
          name: name.data,
          ...(persona === "faculty" ? { department: str(v.department), academicTitle: str(v.academicTitle) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id)),
      ...(await userFactWrites(user.id, [{ group: "identity", field: "full_name", value: name.data }, ...facts, ...personaFacts])),
    ]);
  } catch (error) {
    console.error(`${step} failed`, error);
    return { values: raw, formError: "We couldn't save this. Check your connection and try again." };
  }
  refreshOnboardingShell();
  redirect(stepHref(nextStep(step, user.role)));
}

export async function submitFacultyProfile(_prev: PersonaFormState, formData: FormData) {
  return submitAcademicPersonaStep("faculty_profile", formData);
}
export async function submitMentorship(_prev: PersonaFormState, formData: FormData) {
  return submitPersonaStep("mentorship", formData);
}
export async function submitAlumniProfile(_prev: PersonaFormState, formData: FormData) {
  return submitAcademicPersonaStep("alumni_profile", formData);
}
export async function submitProfessionalProfile(_prev: PersonaFormState, formData: FormData) {
  return submitPersonaStep("professional_profile", formData);
}
export async function submitGiveBack(_prev: PersonaFormState, formData: FormData) {
  return submitPersonaStep("give_back", formData);
}

// ─── Faculty Step 2: research & expertise (autosaved) ───────────────────────

const researchSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(80)).max(15),
  areas: z.array(z.enum(CAREER_ROLE_IDS)).max(CAREER_ROLE_IDS.length),
});

export async function saveResearch(input: { interests: string[]; areas: string[] }): Promise<SaveResult> {
  const { user } = await requireOnboardingStep("research_expertise");
  if (user.role !== "faculty") return { ok: false, error: "This step is for faculty." };
  const parsed = researchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Keep each interest under 80 characters, 15 at most." };

  const seen = new Set<string>();
  const interests = parsed.data.interests.filter((i) => !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()));
  await db.batch([
    db
      .update(onboardingState)
      .set({ researchInterests: interests, expertiseAreas: [...new Set(parsed.data.areas)], updatedAt: new Date() })
      .where(eq(onboardingState.userId, user.id)),
    // Interests are evidence of expertise: one confirmed skill fact each…
    ...(await userFactWrites(
      user.id,
      interests.map((i) => ({ group: "skills", field: "skill", value: i, recordKey: `research:${i.toLowerCase()}` })),
    )),
    // …and a removed interest stops counting.
    db
      .update(profileFacts)
      .set({ confirmation: "rejected" })
      .where(
        and(
          eq(profileFacts.userId, user.id),
          eq(profileFacts.origin, "user_entered"),
          like(profileFacts.recordKey, "research:%"),
          isNull(profileFacts.supersededBy),
          ...(interests.length ? [notInArray(profileFacts.recordKey, interests.map((i) => `research:${i.toLowerCase()}`))] : []),
        ),
      ),
  ]);
  return { ok: true };
}
