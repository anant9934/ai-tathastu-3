import { describe, expect, it } from "vitest";
import {
  parseCodingHandle,
  parseLinkedInUrl,
  parseStackExchangeUrl,
  sourceById,
  sourcesFor,
  connectorReturnPath,
  parseConnectorContext,
} from "@/lib/connectors/sources";

describe("connectors/sources - Handle and URL Parsing", () => {
  describe("parseCodingHandle - LeetCode", () => {
    it("accepts valid bare handles", () => {
      expect(parseCodingHandle("tourist", "leetcode.com")).toBe("tourist");
      expect(parseCodingHandle("user_123", "leetcode.com")).toBe("user_123");
      expect(parseCodingHandle("jane-doe", "leetcode.com")).toBe("jane-doe");
    });

    it("extracts handle from full LeetCode URLs", () => {
      expect(parseCodingHandle("https://leetcode.com/tourist/", "leetcode.com")).toBe("tourist");
      expect(parseCodingHandle("https://leetcode.com/u/tourist/", "leetcode.com")).toBe("tourist");
      expect(parseCodingHandle("leetcode.com/tourist", "leetcode.com")).toBe("tourist");
      expect(parseCodingHandle("www.leetcode.com/u/tourist", "leetcode.com")).toBe("tourist");
    });

    it("rejects malicious or invalid inputs for LeetCode", () => {
      expect(parseCodingHandle("https://evil.com/tourist", "leetcode.com")).toBeNull();
      expect(parseCodingHandle("tourist; rm -rf /", "leetcode.com")).toBeNull();
      expect(parseCodingHandle("", "leetcode.com")).toBeNull();
    });
  });

  describe("parseCodingHandle - HackerRank", () => {
    it("accepts valid bare handles", () => {
      expect(parseCodingHandle("dev_coder", "hackerrank.com")).toBe("dev_coder");
    });

    it("extracts handle from HackerRank URLs", () => {
      expect(parseCodingHandle("https://www.hackerrank.com/profile/dev_coder", "hackerrank.com")).toBe("dev_coder");
      expect(parseCodingHandle("https://hackerrank.com/dev_coder", "hackerrank.com")).toBe("dev_coder");
    });

    it("rejects invalid domains or handles", () => {
      expect(parseCodingHandle("https://hackerrank.evil.com/dev_coder", "hackerrank.com")).toBeNull();
      expect(parseCodingHandle("has spaces", "hackerrank.com")).toBeNull();
    });
  });

  describe("parseLinkedInUrl", () => {
    it("canonicalizes valid linkedin.com/in/ URLs", () => {
      expect(parseLinkedInUrl("https://www.linkedin.com/in/alex-smith")).toBe("https://www.linkedin.com/in/alex-smith");
      expect(parseLinkedInUrl("linkedin.com/in/alex-smith")).toBe("https://www.linkedin.com/in/alex-smith");
      expect(parseLinkedInUrl("https://in.linkedin.com/in/priyanshu-sharma/")).toBe("https://www.linkedin.com/in/priyanshu-sharma");
    });

    it("ignores query params and tracking tokens", () => {
      expect(parseLinkedInUrl("https://www.linkedin.com/in/alex-smith?trk=people-guest")).toBe("https://www.linkedin.com/in/alex-smith");
    });

    it("rejects non-profile or external links", () => {
      expect(parseLinkedInUrl("https://www.linkedin.com/company/google")).toBeNull();
      expect(parseLinkedInUrl("https://evil-linkedin.com/in/fake")).toBeNull();
      expect(parseLinkedInUrl("not a url")).toBeNull();
    });
  });

  describe("parseStackExchangeUrl", () => {
    it("parses valid Stack Overflow user profile URLs", () => {
      const parsed = parseStackExchangeUrl("https://stackoverflow.com/users/123456/john-doe");
      expect(parsed).toEqual({ site: "stackoverflow", userId: 123456 });
    });

    it("parses valid Server Fault user profile URLs", () => {
      const parsed = parseStackExchangeUrl("https://serverfault.com/users/789/sysadmin");
      expect(parsed).toEqual({ site: "serverfault", userId: 789 });
    });

    it("parses network stackexchange subdomain URLs", () => {
      const parsed = parseStackExchangeUrl("https://ai.stackexchange.com/users/42/researcher");
      expect(parsed).toEqual({ site: "ai", userId: 42 });
    });

    it("rejects non-https, invalid sites, or bad user IDs", () => {
      expect(parseStackExchangeUrl("http://stackoverflow.com/users/123/bad")).toBeNull();
      expect(parseStackExchangeUrl("https://evil.com/users/123")).toBeNull();
      expect(parseStackExchangeUrl("https://stackoverflow.com/questions/12345")).toBeNull();
    });
  });

  describe("source catalog and context routing", () => {
    it("finds source definitions by id", () => {
      expect(sourceById("github")?.name).toBe("GitHub");
      expect(sourceById("orcid")?.accessMethod).toBe("oauth");
      expect(sourceById("nonexistent")).toBeUndefined();
    });

    it("maps sources per persona accurately", () => {
      const studentSources = sourcesFor("student").map((s) => s.id);
      expect(studentSources).toContain("github");
      expect(studentSources).toContain("leetcode");
      expect(studentSources).toContain("hackerrank");

      const facultySources = sourcesFor("faculty").map((s) => s.id);
      expect(facultySources).toContain("orcid");
      expect(facultySources).toContain("google_scholar");
    });

    it("resolves connector return paths correctly", () => {
      expect(connectorReturnPath("onboarding")).toBe("/onboarding/connect-sources");
      expect(connectorReturnPath("connections")).toBe("/connections");
      expect(connectorReturnPath("research")).toBe("/onboarding/research-expertise");

      expect(parseConnectorContext("connections")).toBe("connections");
      expect(parseConnectorContext("research")).toBe("research");
      expect(parseConnectorContext("anything_else")).toBe("onboarding");
      expect(parseConnectorContext(null)).toBe("onboarding");
    });
  });
});
