import "server-only";

import { z } from "zod";

import type { users } from "@/db/schema";
import { degreeCatalog, institutionForUser, pendingInstitutionFor, verifiedInstitutions } from "@/lib/academic/catalog";
import { academicYearsFor, countryName, exactMatch, specializationsFor } from "@/lib/academic/match";
import type { UserFact } from "@/lib/onboarding/user-facts";

/**
 * The academic block shared by Step 1 of every persona: institution (catalogue
 * pick or "Other / Not listed"), location, degree → specialization, and,
 * per persona, the current year and/or graduation year.
 *
 *   student: current year + expected graduation
 *   alumni:  graduation year (completed)
 *   faculty: highest degree only
 *
 * Every pick is re-validated against the catalogue: a specialization must
 * belong to the degree, a year must exist for it.
 */

export type AcademicMode = { year: boolean; graduation: "expected" | "completed" | null };

export const ACADEMIC_FIELDS = [
  "institutionId", "institutionName", "city", "state", "country", "degree", "specialization",
  "specializationOther", "academicYear", "graduationYear",
] as const;
export type AcademicField = (typeof ACADEMIC_FIELDS)[number] | "institution";
export type AcademicRaw = Record<(typeof ACADEMIC_FIELDS)[number], string>;

const OTHER = "other";
const THIS_YEAR = new Date().getFullYear();
export const GRADUATION_RANGE = {
  expected: [THIS_YEAR - 1, THIS_YEAR + 10],
  completed: [1950, THIS_YEAR + 1],
} as const;

const text = (max: number) => z.string().trim().max(max).transform((s) => s.replace(/\s+/g, " "));

export function readAcademic(formData: FormData): AcademicRaw {
  return Object.fromEntries(ACADEMIC_FIELDS.map((k) => [k, String(formData.get(k) ?? "").trim()])) as AcademicRaw;
}

type Resolved = {
  institution: { id: string | null; name: string; city: string | null; state: string | null; country: string | null; pending: boolean };
  degree: { id: string; name: string };
  specialization: { id: string; name: string | null };
  academicYear: string | null;
  graduationYear: number | null;
};

export async function validateAcademic(
  raw: AcademicRaw,
  userId: string,
  mode: AcademicMode,
): Promise<{ errors: Partial<Record<AcademicField, string>>; value: Resolved | null }> {
  const errors: Partial<Record<AcademicField, string>> = {};
  const fail = (field: AcademicField, message: string) => (errors[field] ??= message);

  // ── Institution ──
  let institution: Resolved["institution"] | null = null;
  if (raw.institutionId === OTHER) {
    const name = text(160).parse(raw.institutionName.slice(0, 160));
    const city = text(80).parse(raw.city.slice(0, 80));
    const country = text(80).parse(raw.country.slice(0, 80));
    if (!name) fail("institutionName", "Enter your institution's name.");
    if (!city) fail("city", "Enter the city.");
    if (!country) fail("country", "Enter the country.");
    const known = exactMatch(name, await verifiedInstitutions());
    if (known) {
      // Typed a name we already have: use the catalogue entry, not a duplicate.
      institution = { id: known.id, name: known.canonicalName, city: known.city, state: known.state, country: countryName(known.countryCode) || null, pending: false };
    } else if (name && city && country) {
      institution = { id: null, name, city, state: text(80).parse(raw.state.slice(0, 80)) || null, country, pending: true };
    }
  } else if (raw.institutionId) {
    const row = z.uuid().safeParse(raw.institutionId).success ? await institutionForUser(raw.institutionId, userId) : null;
    if (!row) fail("institution", "Choose your institution from the list, or pick Other / Not listed.");
    else
      institution = {
        id: row.id, name: row.canonicalName, city: row.city, state: row.state,
        country: countryName(row.countryCode) || null, pending: row.verificationStatus === "pending",
      };
  } else {
    fail("institution", "Choose your institution, or pick Other / Not listed.");
  }

  // ── Degree → specialization → year ──
  const catalog = await degreeCatalog();
  const degree = catalog.degrees.find((d) => d.id === raw.degree) ?? null;
  if (!degree) fail("degree", "Choose a degree.");
  const specialization = degree ? specializationsFor(degree.id, catalog.specializations).find((s) => s.id === raw.specialization) ?? null : null;
  if (degree && !specialization) fail("specialization", "Choose a specialization for this degree.");
  if (mode.year && degree && !academicYearsFor(degree).includes(raw.academicYear)) fail("academicYear", "Choose your current year.");

  let graduationYear: number | null = null;
  if (mode.graduation) {
    const [min, max] = GRADUATION_RANGE[mode.graduation];
    graduationYear = Number(raw.graduationYear);
    if (!raw.graduationYear || !Number.isInteger(graduationYear) || graduationYear < min || graduationYear > max) {
      fail("graduationYear", mode.graduation === "expected" ? "Choose your expected graduation year." : "Choose your graduation year.");
    }
  }

  if (Object.keys(errors).length || !institution || !degree || !specialization) return { errors, value: null };
  const otherSpec = specialization.canonicalName === "Other";
  return {
    errors,
    value: {
      institution,
      degree: { id: degree.id, name: degree.canonicalName },
      specialization: { id: specialization.id, name: otherSpec ? text(120).parse(raw.specializationOther.slice(0, 120)) || null : specialization.canonicalName },
      academicYear: mode.year ? raw.academicYear : null,
      graduationYear,
    },
  };
}

/** users columns (ids + legacy text) and confirmed facts for a validated block. Creates a pending institution if needed. */
export async function academicWrites(userId: string, v: Resolved, mode: AcademicMode) {
  const institutionId =
    v.institution.id ??
    (await pendingInstitutionFor(userId, { name: v.institution.name, city: v.institution.city ?? "", state: v.institution.state, countryCode: null }));
  const set: Partial<typeof users.$inferInsert> = {
    institutionId,
    degreeId: v.degree.id,
    specializationId: v.specialization.id,
    // Legacy text columns, still read by the profile, the worker and the integrations.
    university: v.institution.name,
    degree: v.degree.name,
    specialization: v.specialization.name,
    city: v.institution.city,
    state: v.institution.state,
    country: v.institution.country,
    ...(mode.year ? { currentAcademicYear: v.academicYear, academicYear: v.academicYear } : {}),
    ...(mode.graduation === "expected" ? { expectedGraduationYear: v.graduationYear } : {}),
    ...(mode.graduation === "completed" ? { graduationYear: v.graduationYear, academicYear: "Graduated" } : {}),
  };
  const facts: UserFact[] = [
    { group: "identity", field: "university", value: v.institution.name },
    { group: "identity", field: "degree", value: v.degree.name },
    { group: "identity", field: "specialization", value: v.specialization.name },
    { group: "identity", field: "city", value: v.institution.city },
    { group: "identity", field: "country", value: v.institution.country },
    ...(mode.year ? [{ group: "identity", field: "academic_year", value: v.academicYear }] : []),
  ];
  return { set, facts };
}
