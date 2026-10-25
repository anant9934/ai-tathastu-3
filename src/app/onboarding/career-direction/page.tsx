import type { Metadata } from "next";
import { Suspense } from "react";

import { CareerDirectionForm } from "@/components/onboarding/career-direction-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "Career direction · AI Tathastu" };

export default function CareerDirectionPage() {
  return (
    <>
      <StepHeader
        step="career_direction"
        title={
          <>
            Where are you{" "}
            <span className="font-serif font-normal italic text-[#FF2A85]">
              headed?
            </span>
          </>
        }
      >
        Pick the direction you want AI Tathastu to help you with. Choose more than one if you&apos;re torn; you can change this anytime.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <CareerDirectionStep />
      </Suspense>
    </>
  );
}

async function CareerDirectionStep() {
  const { state } = await requireOnboardingStep("career_direction");
  return <CareerDirectionForm initialRoles={state.careerRoles} initialOther={state.careerRoleOther ?? ""} />;
}
