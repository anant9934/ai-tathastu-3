// Pure academic-catalogue logic, shared by the search API, the Step 3 form,
// the backfill script and tests. No I/O, no server-only.

export type Named = { canonicalName: string; aliases: string[] };

/** Lowercase, "&" → "and", punctuation and accents removed, spaces collapsed. "I.I.T. (BHU)" → "iit bhu". */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const names = (x: Named) => [x.canonicalName, ...x.aliases].map(normalizeName);

/**
 * Relevance of one catalogue entry for a query; 0 = no match.
 *  100 exact name or alias ("LPU", "iit bombay") · 80 name starts with the query
 *  · 70 an alias starts with it · 60 every query word starts a word of the
 *  name or an alias ("tech munich") · 40 substring of the name · 30 of an alias.
 */
export function matchScore(query: string, entry: Named): number {
  const q = normalizeName(query);
  if (!q) return 0;
  const [canonical, ...aliases] = names(entry);
  if (canonical === q || aliases.includes(q)) return 100;
  if (canonical.startsWith(q)) return 80;
  if (aliases.some((a) => a.startsWith(q))) return 70;
  const qWords = q.split(" ");
  const wordsOf = (s: string) => s.split(" ");
  if ([canonical, ...aliases].some((n) => qWords.every((w) => wordsOf(n).some((nw) => nw.startsWith(w))))) return 60;
  if (canonical.includes(q)) return 40;
  if (aliases.some((a) => a.includes(q))) return 30;
  return 0;
}

/** Best matches first; ties by name. */
export function rankByName<T extends Named>(query: string, entries: readonly T[], limit = 8): T[] {
  return entries
    .map((e) => ({ e, score: matchScore(query, e) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.canonicalName.localeCompare(b.e.canonicalName))
    .slice(0, limit)
    .map((x) => x.e);
}

/**
 * Only an exact name/alias match, and only when it's unambiguous (two
 * entries sharing an alias, like "SNU", match neither). Used to migrate
 * free-text values: anything less than exact is left alone.
 */
export function exactMatch<T extends Named>(text: string | null | undefined, entries: readonly T[]): T | null {
  const q = normalizeName(text ?? "");
  if (!q) return null;
  const hits = entries.filter((e) => names(e).includes(q));
  return hits.length === 1 ? hits[0] : null;
}

// ─── Degrees: years of study ────────────────────────────────────────────────

export type DegreeInfo = { id: string; canonicalName: string; level: string; durationYears: number | null };

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

/** Academic-year options for a degree. Ph.D. counts research years; unknown lengths offer five. */
export function academicYearsFor(degree: Pick<DegreeInfo, "level" | "durationYears"> | null | undefined): string[] {
  if (!degree) return [];
  if (degree.level === "doctoral") return ["Research year 1", "Research year 2", "Research year 3", "Research year 4", "Research year 5", "Research year 6+"];
  const n = degree.durationYears ?? 5;
  return ORDINAL.slice(0, n).map((o) => `${o} year`);
}

/**
 * Likely graduation year: the academic year ends in June/July, so from July a
 * 1st-year in a 4-year degree graduates in (this year + 1) + 3.
 */
export function suggestedGraduationYear(
  degree: Pick<DegreeInfo, "level" | "durationYears"> | null | undefined,
  academicYear: string | null | undefined,
  now = new Date(),
): number | null {
  if (!degree || !academicYear) return null;
  const years = academicYearsFor(degree);
  const index = years.indexOf(academicYear);
  if (index < 0) return null;
  const endOfThisAcademicYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const total = degree.level === "doctoral" ? 5 : (degree.durationYears ?? years.length);
  return endOfThisAcademicYear + Math.max(0, total - (index + 1));
}

// ─── Dependent fields ───────────────────────────────────────────────────────

export type AcademicSelection = { degreeId: string; specializationId: string; academicYear: string };
export type SpecializationInfo = { id: string; canonicalName: string; applicableDegreeIds: string[] };

export const specializationsFor = <T extends SpecializationInfo>(degreeId: string, all: readonly T[]) =>
  degreeId ? all.filter((s) => s.applicableDegreeIds.includes(degreeId)) : [];

/**
 * Changing the degree changes which specializations and years exist: keep a
 * specialization only if it also applies to the new degree, and always clear
 * the year (its meaning changes with the degree).
 */
export function changeDegree(
  current: AcademicSelection,
  degreeId: string,
  specializations: readonly SpecializationInfo[],
): AcademicSelection {
  if (degreeId === current.degreeId) return current;
  const stillValid = specializationsFor(degreeId, specializations).some((s) => s.id === current.specializationId);
  return { degreeId, specializationId: stillValid ? current.specializationId : "", academicYear: "" };
}

/** Country name for an ISO code ("IN" → "India"). */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
