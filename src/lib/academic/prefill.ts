import "server-only";

import type { User } from "@/db/schema";
import { degreeCatalog, institutionForUser, toOption } from "@/lib/academic/catalog";
import type { InstitutionValue } from "@/components/onboarding/institution-combobox";
import { academicYearsFor, exactMatch } from "@/lib/academic/match";

/**
 * Initial values for the academic block of any persona's Step 1. A catalogue
 * pick shows in the combobox; a pending entry, or legacy free text with no
 * catalogue match, reopens as "Other / Not listed" with its details.
 */
export async function academicPrefill(user: User, graduation: "expected" | "completed" | null) {
  const [catalog, row] = await Promise.all([
    degreeCatalog(),
    user.institutionId ? institutionForUser(user.institutionId, user.id) : null,
  ]);
  const pendingOrLegacy = row?.verificationStatus === "pending" || (!row && Boolean(user.university));
  const institution: InstitutionValue = row && row.verificationStatus === "verified" ? toOption(row) : pendingOrLegacy ? { other: true } : null;
  const degree = catalog.degrees.find((d) => d.id === user.degreeId) ?? exactMatch(user.degree, catalog.degrees);
  const years = academicYearsFor(degree);
  const grad = graduation === "expected" ? user.expectedGraduationYear : graduation === "completed" ? user.graduationYear : null;
  const specOk = catalog.specializations.some((s) => s.id === user.specializationId && degree && s.applicableDegreeIds.includes(degree.id));

  return {
    catalog,
    institution,
    values: {
      // Pre-filled from Google/LinkedIn on first sign-in.
      fullName: user.name ?? "",
      institutionName: pendingOrLegacy ? (row?.canonicalName ?? user.university ?? "") : "",
      city: user.city ?? "",
      state: user.state ?? "",
      country: user.country ?? "",
      degree: degree?.id ?? "",
      specialization: specOk ? user.specializationId! : "",
      specializationOther: "",
      academicYear: [user.currentAcademicYear, user.academicYear].find((y) => y && years.includes(y)) ?? "",
      graduationYear: grad ? String(grad) : "",
    } as Record<string, string>,
  };
}
