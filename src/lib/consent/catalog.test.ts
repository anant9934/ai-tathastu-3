import { describe, expect, it } from "vitest";
import { CONSENT_ITEMS, CONSENT_POLICY_VERSION, CONSENT_PURPOSES } from "@/lib/consent/catalog";

describe("consent/catalog - Policy and Items Verification", () => {
  it("defines a valid ISO date for CONSENT_POLICY_VERSION", () => {
    expect(CONSENT_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes all 4 defined consent purposes", () => {
    expect(CONSENT_PURPOSES).toEqual(["external_ai", "linkedin_scrape", "mentor_discovery", "analytics"]);
  });

  it("every consent item has clear title, body, and without-consequence copy", () => {
    for (const item of CONSENT_ITEMS) {
      expect(item.title.length).toBeGreaterThan(5);
      expect(item.body.length).toBeGreaterThan(20);
      expect(item.without.length).toBeGreaterThan(10);
    }
  });

  it("mentions required privacy safeguards in copy without misleading claims", () => {
    const aiItem = CONSENT_ITEMS.find((c) => c.purpose === "external_ai");
    expect(aiItem?.body).toContain("You review every result before it's saved");

    const linkedinItem = CONSENT_ITEMS.find((c) => c.purpose === "linkedin_scrape");
    expect(linkedinItem?.body).toContain("We never log in as you or use your cookies");
  });
});
