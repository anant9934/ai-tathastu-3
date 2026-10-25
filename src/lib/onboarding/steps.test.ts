import { describe, expect, it } from "vitest";

import { schemaFor } from "@/lib/onboarding/personas";
import { FLOW_LENGTH, FLOWS, firstStep, nextStep, previousStep, stepHref, stepIndex, stepPosition } from "@/lib/onboarding/steps";

describe("persona flows", () => {
  it("every flow has six steps and shares the last three at the same positions", () => {
    for (const flow of Object.values(FLOWS)) {
      expect(flow).toHaveLength(FLOW_LENGTH);
      expect(flow.slice(3)).toEqual(["resume", "connectors", "review"]);
    }
    expect(stepPosition("resume")).toBe(3);
    expect(stepPosition("research_expertise")).toBe(1);
    expect(stepPosition("give_back")).toBe(2);
  });

  it("walks each flow in order, from Step 0 to done", () => {
    expect(firstStep("faculty")).toBe("faculty_profile");
    expect(nextStep("faculty_profile", "faculty")).toBe("research_expertise");
    expect(nextStep("give_back", "alumni")).toBe("resume");
    expect(nextStep("review", "alumni")).toBe("done");
    expect(previousStep("alumni_profile", "alumni")).toBe("role");
    expect(previousStep("resume", "faculty")).toBe("mentorship");
    expect(previousStep("resume", "student")).toBe("basic_profile");
    expect(stepHref("role")).toBe("/onboarding/role");
  });

  it("another persona's step is outside the flow (the guard redirects)", () => {
    expect(stepIndex("career_direction", "faculty")).toBe(-1);
    expect(stepIndex("mentorship", "alumni")).toBe(-1);
    expect(stepIndex("role", "student")).toBe(-1);
    expect(stepIndex("done", "alumni")).toBe(FLOW_LENGTH);
  });
});

describe("persona form validation", () => {
  it("requires the profile fields and checks numbers and selects", () => {
    // Institution and degree are validated by the shared academic block; the persona fields here.
    const faculty = schemaFor("faculty_profile").safeParse({ department: "", academicTitle: "Dean" });
    expect(faculty.success).toBe(false);
    expect(faculty.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["department", "academicTitle"]));
    expect(schemaFor("faculty_profile").parse({ department: " CSE ", academicTitle: "Professor" })).toEqual({ department: "CSE", academicTitle: "Professor" });

    expect(schemaFor("mentorship").safeParse({ capacity: "51" }).success).toBe(false);
    expect(schemaFor("mentorship").parse({ capacity: "3", canVerifyEris: "on" })).toEqual({ capacity: 3, canVerifyEris: true, canReviewResumes: false });
    expect(schemaFor("professional_profile").parse({ company: "Acme", jobTitle: "MLE", careerArea: "" })).toMatchObject({ careerArea: null });
  });
});
