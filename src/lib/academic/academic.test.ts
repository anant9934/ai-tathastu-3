/**
 * Normalized academic profile: catalogue seed, institution search, the
 * degree → specialization → year dependency, legacy matching, and the
 * search API with its analytics. Search API runs on PGlite with every
 * migration (including the 0010 catalogue seed).
 */
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DEGREES, INSTITUTIONS, SPECIALIZATIONS } from "@/db/seeds/academic-catalog";
import {
  academicYearsFor,
  changeDegree,
  exactMatch,
  rankByName,
  specializationsFor,
  suggestedGraduationYear,
} from "@/lib/academic/match";

const state = vi.hoisted(() => ({ userId: "00000000-0000-4000-8000-0000000000e1" as string | null }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/auth", () => ({ auth: async () => (state.userId ? { user: { id: state.userId } } : null) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
  after: (fn: () => unknown) => void fn(),
}));

const institutions = INSTITUTIONS.map((i) => ({ canonicalName: i.name, aliases: i.aliases }));
const degrees = DEGREES.map((d, i) => ({ id: `d${i}`, canonicalName: d.name, aliases: d.aliases, level: d.level, durationYears: d.duration }));
const id = (name: string) => degrees.find((d) => d.canonicalName === name)!.id;
const specializations = SPECIALIZATIONS.map((s, i) => ({
  id: `s${i}`, canonicalName: s.name, aliases: s.aliases, applicableDegreeIds: s.degrees.map(id),
}));
const spec = (name: string) => specializations.find((s) => s.canonicalName === name)!.id;

describe("institution search", () => {
  it('typing "LPU" resolves to Lovely Professional University', () => {
    expect(rankByName("LPU", institutions)[0].canonicalName).toBe("Lovely Professional University");
    expect(rankByName("lpu", institutions)[0].canonicalName).toBe("Lovely Professional University");
  });

  it("matches short names, aliases and partial words", () => {
    expect(rankByName("IITB", institutions)[0].canonicalName).toBe("Indian Institute of Technology Bombay");
    expect(rankByName("iit bombay", institutions)[0].canonicalName).toBe("Indian Institute of Technology Bombay");
    expect(rankByName("NIT Trichy", institutions)[0].canonicalName).toBe("National Institute of Technology Tiruchirappalli");
    expect(rankByName("tech munich", institutions)[0].canonicalName).toBe("Technical University of Munich");
    expect(rankByName("I.I.T. (BHU)", institutions)[0].canonicalName).toBe("Indian Institute of Technology (BHU) Varanasi");
    expect(rankByName("zzzz", institutions)).toEqual([]);
  });

  it("a shared alias returns every match but never auto-links", () => {
    expect(rankByName("SNU", institutions).map((x) => x.canonicalName)).toEqual(["Seoul National University", "Shiv Nadar University"]);
    expect(exactMatch("SNU", institutions)).toBeNull();
  });
});

describe("degree → specialization → year", () => {
  it("seeds exactly the eight degrees", () => {
    expect(DEGREES.map((d) => d.name)).toEqual([
      "B.Tech / B.E.", "M.Tech", "MCA", "BCA", "Diploma", "Ph.D.", "Integrated bachelor's and master's programmes", "Other",
    ]);
  });

  it("selecting M.Tech changes the specialization options and clears an invalid previous selection", () => {
    const btech = specializationsFor(id("B.Tech / B.E."), specializations).map((s) => s.canonicalName);
    const mtech = specializationsFor(id("M.Tech"), specializations).map((s) => s.canonicalName);
    expect(btech).toContain("Civil Engineering");
    expect(mtech).not.toContain("Civil Engineering");
    expect(mtech).toContain("VLSI Design");
    expect(btech).not.toContain("VLSI Design");

    // Civil isn't offered for M.Tech: cleared. The year always resets.
    const fromCivil = changeDegree({ degreeId: id("B.Tech / B.E."), specializationId: spec("Civil Engineering"), academicYear: "3rd year" }, id("M.Tech"), specializations);
    expect(fromCivil).toEqual({ degreeId: id("M.Tech"), specializationId: "", academicYear: "" });
    // CSE exists for both: kept.
    const fromCse = changeDegree({ degreeId: id("B.Tech / B.E."), specializationId: spec("Computer Science and Engineering"), academicYear: "3rd year" }, id("M.Tech"), specializations);
    expect(fromCse.specializationId).toBe(spec("Computer Science and Engineering"));
    expect(fromCse.academicYear).toBe("");
  });

  it("years follow the degree", () => {
    const d = (name: string) => degrees.find((x) => x.canonicalName === name)!;
    expect(academicYearsFor(d("B.Tech / B.E."))).toEqual(["1st year", "2nd year", "3rd year", "4th year"]);
    expect(academicYearsFor(d("M.Tech"))).toEqual(["1st year", "2nd year"]);
    expect(academicYearsFor(d("BCA"))).toHaveLength(3);
    expect(academicYearsFor(d("Ph.D."))[0]).toBe("Research year 1");
    // October 2026, 1st year of a 4-year degree → graduates 2030; 4th year → 2027.
    const oct = new Date(2026, 9, 1);
    expect(suggestedGraduationYear(d("B.Tech / B.E."), "1st year", oct)).toBe(2030);
    expect(suggestedGraduationYear(d("B.Tech / B.E."), "4th year", oct)).toBe(2027);
    expect(suggestedGraduationYear(d("M.Tech"), "1st year", new Date(2026, 2, 1))).toBe(2027);
  });

  it("legacy free text links only on an exact name or alias", () => {
    expect(exactMatch("B.Tech", degrees)?.canonicalName).toBe("B.Tech / B.E.");
    expect(exactMatch("BE", degrees)?.canonicalName).toBe("B.Tech / B.E.");
    expect(exactMatch("IIT Madras", institutions)?.canonicalName).toBe("Indian Institute of Technology Madras");
    expect(exactMatch("Indian Inst of Tech Madras", institutions)).toBeNull();
  });
});

describe("seeded catalogue and search API", () => {
  let db: Awaited<typeof import("@/db")>["db"];
  let schema: typeof import("@/db/schema");
  beforeAll(async () => {
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    await db.insert(schema.users).values({ id: state.userId!, email: "seed@example.com" });
  });

  it("migration 0010 seeds the catalogue", async () => {
    expect(await db.$count(schema.degrees)).toBe(8);
    expect(await db.$count(schema.institutions)).toBe(INSTITUTIONS.length);
    const [mtech] = await db.select().from(schema.degrees).where(eq(schema.degrees.canonicalName, "M.Tech"));
    const [vlsi] = await db.select().from(schema.specializations).where(eq(schema.specializations.canonicalName, "VLSI Design"));
    expect(vlsi.applicableDegreeIds).toEqual([mtech.id]);
  });

  it("GET /api/academic/institutions ranks aliases and logs anonymous analytics without consent", async () => {
    const { GET } = await import("@/app/api/academic/institutions/route");
    const res = await GET(new Request("https://x/api/academic/institutions?q=LPU"));
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ name: "Lovely Professional University", city: "Phagwara", state: "Punjab", countryCode: "IN" });

    await GET(new Request("https://x/api/academic/institutions?q=Nowhere%20Institute"));
    // Logged after the response (after()): wait for the writes.
    const events = await vi.waitFor(async () => {
      const rows = await db.select().from(schema.analyticsEvents);
      expect(rows).toHaveLength(3);
      return rows;
    });
    expect(events.map((e) => e.event).sort()).toEqual(["institution_search", "institution_search", "search_no_results"]);
    expect(events.every((e) => e.userId === null)).toBe(true); // no analytics consent given
    expect(events.find((e) => e.event === "search_no_results")!.properties).toEqual({ query: "Nowhere Institute" });
  });

  it("401 without a session", async () => {
    const { GET } = await import("@/app/api/academic/institutions/route");
    state.userId = null;
    expect((await GET(new Request("https://x/api/academic/institutions?q=IIT"))).status).toBe(401);
    state.userId = "00000000-0000-4000-8000-0000000000e1";
  });
});
