/**
 * Validates and normalizes callback URLs to prevent open redirect vulnerabilities.
 * Ensures that redirects only ever target internal relative paths within this origin.
 */
export function toLocalPath(callbackUrl: string | null | undefined, fallback = "/onboarding"): string {
  if (!callbackUrl || typeof callbackUrl !== "string") return fallback;

  const trimmed = callbackUrl.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://local.invalid");
    // Ensure the path is within the same virtual origin
    if (parsed.origin !== "http://local.invalid") {
      return fallback;
    }

    const path = parsed.pathname + parsed.search + parsed.hash;
    // Reject protocol-relative or backslash paths
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
      return fallback;
    }

    return path;
  } catch {
    return fallback;
  }
}
