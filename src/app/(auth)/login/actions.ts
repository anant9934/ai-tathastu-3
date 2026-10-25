"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { emailProviderId } from "@/lib/auth-providers";

/** Only same-origin paths; anything else falls back to the wizard. */
function safeRedirect(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/onboarding";
}

export async function signInWithProvider(formData: FormData) {
  const requested = formData.get("provider");
  // The form says "email"; the configured email provider decides the Auth.js id.
  const provider = requested === "email" ? emailProviderId() : requested;
  if (provider !== "google" && provider !== "linkedin" && provider !== "resend" && provider !== "nodemailer") {
    redirect("/login?error=Configuration");
  }

  try {
    await signIn(provider, {
      redirectTo: safeRedirect(formData.get("redirectTo")),
      ...(requested === "email" ? { email: String(formData.get("email") ?? "").trim() } : {}),
    });
  } catch (error) {
    // signIn() redirects by throwing; only Auth.js errors are ours to handle.
    if (error instanceof AuthError) redirect(`/login?error=${error.type}`);
    throw error;
  }
}
