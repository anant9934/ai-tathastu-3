import type { Metadata } from "next";
import { Suspense } from "react";

import { PrioritiesForm } from "@/components/onboarding/priorities-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "Priorities · AI Tathastu" };

export default function PrioritiesPage() {
  return (
    <>
      <StepHeader
        step="priorities"
        title={
          <>
            What{" "}
            <span className="font-serif font-normal italic text-[#FF2A85]">
              matters most
            </span>{" "}
            right now?
          </>
        }
      >
        Choose up to 3 priorities. Your first pick helps us personalize your experience.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <PrioritiesStep />
      </Suspense>
    </>
  );
}

async function PrioritiesStep() {
  const { state } = await requireOnboardingStep("priorities");
  return <PrioritiesForm initialPriorities={state.priorities} />;
}
