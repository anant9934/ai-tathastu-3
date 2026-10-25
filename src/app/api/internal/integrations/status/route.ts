import { connection, NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkIntegrationConfig } from "@/lib/integrations/config-check";
import { publicJwks } from "@/lib/integrations/tokens";
import { isInternalCall } from "@/lib/internal-auth";

/**
 * GET /api/internal/integrations/status — operator check of the integration
 * settings in this deployment, without revealing them: presence, format
 * problems, 8-character fingerprints, flags, and whether the signing key
 * loads. Bearer INTERNAL_API_SECRET. Never returns values.
 */
export async function GET(request: Request) {
  await connection();
  if (!isInternalCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let signingKey: { loads: boolean; kids?: string[]; error?: string };
  try {
    signingKey = { loads: true, kids: (await publicJwks()).keys.map((k) => k.kid!) };
  } catch (e) {
    signingKey = { loads: false, error: e instanceof Error ? e.message : "failed" };
  }
  const checks = checkIntegrationConfig();
  return NextResponse.json(
    {
      ok: signingKey.loads && checks.every((c) => c.ok),
      deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      signingKey,
      flags: {
        collaborate_profile_api: await isFeatureEnabled("collaborate_profile_api"),
        meet_profile_api: await isFeatureEnabled("meet_profile_api"),
      },
      checks,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
