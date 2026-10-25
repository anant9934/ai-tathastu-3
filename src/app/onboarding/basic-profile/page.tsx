import type { Metadata } from "next";
import { Suspense } from "react";

import { saveProfileDraft, submitBasicProfile } from "@/app/onboarding/basic-profile/actions";
import { AcademicStepForm } from "@/components/onboarding/academic-step-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { academicPrefill } from "@/lib/academic/prefill";
import { requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "Basic profile · AI Tathastu" };

const saveName = async (value: string) => {
  "use server";
  return saveProfileDraft("fullName", value);
};

export default function BasicProfilePage() {
  return (
    <>
      <StepHeader
        step="basic_profile"
        title={
          <>
            Tell us about{" "}
            <span className="font-serif font-normal italic text-[#FF2A85]">
              yourself
            </span>
          </>
        }
      >
        This helps us personalize your dashboard and match you with the right opportunities.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <BasicProfileStep />
      </Suspense>
    </>
  );
}

async function BasicProfileStep() {
  const { user } = await requireOnboardingStep("basic_profile");
  const { catalog, institution, values } = await academicPrefill(user, "expected");
  return (
    <AcademicStepForm
      action={submitBasicProfile}
      saveName={saveName}
      mode={{ year: true, graduation: "expected" }}
      catalog={catalog}
      initialInstitution={institution}
      initialValues={values}
      backStep="priorities"
    />
  );
}
