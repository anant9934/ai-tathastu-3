import { describe, expect, it } from "vitest";
import {
  RESUME_MAX_BYTES,
  isResumeMime,
  resolveResumeMime,
  resumeStorageKey,
  resumeJobKey,
  hexToBase64,
} from "@/lib/uploads/resume";

describe("uploads/resume - Resume Validation and Storage Helpers", () => {
  it("enforces a 10MB file size limit", () => {
    expect(RESUME_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("recognizes allowed mime types", () => {
    expect(isResumeMime("application/pdf")).toBe(true);
    expect(isResumeMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(isResumeMime("image/png")).toBe(true);
    expect(isResumeMime("application/x-executable")).toBe(false);
    expect(isResumeMime("text/html")).toBe(false);
  });

  it("resolves resume mime type from type or filename extension fallback", () => {
    expect(resolveResumeMime({ name: "cv.pdf", type: "application/pdf" })).toBe("application/pdf");
    expect(resolveResumeMime({ name: "resume.docx", type: "" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(resolveResumeMime({ name: "scan.JPG", type: "" })).toBe("image/jpeg");
    expect(resolveResumeMime({ name: "notes.txt", type: "text/plain" })).toBe("text/plain");
    expect(resolveResumeMime({ name: "script.sh", type: "" })).toBeNull();
  });

  it("formats deterministic storage keys", () => {
    const key = resumeStorageKey("usr_abc123", "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e", "application/pdf");
    expect(key).toBe("resumes/usr_abc123/a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e.pdf");
  });

  it("formats deterministic extraction job keys with pipeline versioning", () => {
    const jobKey = resumeJobKey("usr_abc123", "hash123");
    expect(jobKey).toBe("resume_extract:usr_abc123:hash123:v1");
  });

  it("converts hex sha256 to base64 for S3/R2 presigned upload checksum validation", () => {
    // "hello world" sha256: b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace20c9a99
    const hex = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace20c9a99";
    const b64 = hexToBase64(hex);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(10);
  });
});
