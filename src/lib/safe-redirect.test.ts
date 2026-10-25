import { describe, expect, it } from "vitest";
import { toLocalPath } from "@/lib/safe-redirect";

describe("toLocalPath - Open Redirect Protection", () => {
  it("allows standard valid relative paths", () => {
    expect(toLocalPath("/dashboard")).toBe("/dashboard");
    expect(toLocalPath("/onboarding/career-direction")).toBe("/onboarding/career-direction");
    expect(toLocalPath("/login")).toBe("/login");
    expect(toLocalPath("/")).toBe("/");
  });

  it("preserves valid query parameters and hashes on relative paths", () => {
    expect(toLocalPath("/dashboard?tab=profile&view=full")).toBe("/dashboard?tab=profile&view=full");
    expect(toLocalPath("/onboarding/basic-profile#academic")).toBe("/onboarding/basic-profile#academic");
  });

  it("blocks protocol-relative URLs that attempt open redirects", () => {
    expect(toLocalPath("//evil.com")).toBe("/onboarding");
    expect(toLocalPath("//evil.com/phish")).toBe("/onboarding");
    expect(toLocalPath("///evil.com")).toBe("/onboarding");
  });

  it("blocks backslash open redirect tricks", () => {
    expect(toLocalPath("\\\\evil.com")).toBe("/onboarding");
    expect(toLocalPath("/\\evil.com")).toBe("/onboarding");
    expect(toLocalPath("\\evil.com")).toBe("/onboarding");
  });

  it("blocks absolute URLs to external hosts", () => {
    expect(toLocalPath("https://evil.com")).toBe("/onboarding");
    expect(toLocalPath("http://attacker.org/steal")).toBe("/onboarding");
    expect(toLocalPath("ftp://evil.com")).toBe("/onboarding");
  });

  it("blocks javascript: and data: pseudo-protocols", () => {
    expect(toLocalPath("javascript:alert(1)")).toBe("/onboarding");
    expect(toLocalPath("data:text/html,<script>alert(1)</script>")).toBe("/onboarding");
  });

  it("handles null, undefined, empty, or whitespace strings safely", () => {
    expect(toLocalPath(null)).toBe("/onboarding");
    expect(toLocalPath(undefined)).toBe("/onboarding");
    expect(toLocalPath("")).toBe("/onboarding");
    expect(toLocalPath("   ")).toBe("/onboarding");
  });

  it("respects custom fallback path when provided", () => {
    expect(toLocalPath("https://evil.com", "/dashboard")).toBe("/dashboard");
    expect(toLocalPath("//evil.com", "/login")).toBe("/login");
    expect(toLocalPath(null, "/")).toBe("/");
  });
});
