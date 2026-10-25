import { NextResponse } from "next/server";

import { isIntegrationKeyConfigured, publicJwks } from "@/lib/integrations/tokens";

/** Public keys for verifying integration access tokens (ES256). Safe to cache for an hour. */
export async function GET() {
  if (!isIntegrationKeyConfigured()) return NextResponse.json({ keys: [] }, { status: 503 });
  return NextResponse.json(await publicJwks(), {
    headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  });
}
