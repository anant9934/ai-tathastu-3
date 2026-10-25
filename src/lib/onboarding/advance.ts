import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { onboardingState, type OnboardingState, type User } from "@/db/schema";
import { nextStep, stepIndex, type WizardStep } from "@/lib/onboarding/steps";

/** Moves current_step forward only if the user is on `step`; revisits never rewind it. */
export function advanceStepQuery(user: Pick<User, "id" | "role">, state: OnboardingState, step: WizardStep) {
  const reached = stepIndex(state.currentStep, user.role) > stepIndex(step, user.role);
  return db
    .update(onboardingState)
    .set({ currentStep: reached ? state.currentStep : nextStep(step, user.role), updatedAt: new Date() })
    .where(eq(onboardingState.userId, user.id));
}
