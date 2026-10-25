import "server-only";

import { revalidatePath } from "next/cache";

/**
 * The onboarding layout (its step rail and persona) is shared across steps, so
 * client navigation keeps the old render. Call before redirecting from an
 * action that changes the persona or the current step.
 */
export const refreshOnboardingShell = () => revalidatePath("/onboarding", "layout");
