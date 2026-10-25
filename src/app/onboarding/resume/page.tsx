import type { Metadata } from "next";
import { Suspense } from "react";

import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { ResumeUploader } from "@/components/resume/resume-uploader";
import { getCurrentConsents } from "@/lib/consent/store";
import { getLatestResumeJob, requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "Resume · AI Tathastu" };

export default function ResumePage() {
  return (
    <>
      <StepHeader
        step="resume"
        title={
          <>
            Import your{" "}
            <span className="font-serif font-normal italic text-[#FF2A85]">
              resume
            </span>
          </>
        }
      >
        We read it and pre-fill your education, experience, projects and skills. You can review and edit everything before saving.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <ResumeStep />
      </Suspense>
    </>
  );
}

async function ResumeStep() {
  const { user } = await requireOnboardingStep("resume");
  const [job, consents] = await Promise.all([getLatestResumeJob(user.id), getCurrentConsents(user.id)]);
  return <ResumeUploader initialJob={job} initialAiConsent={consents.external_ai?.granted === true} persona={user.role} />;
}
