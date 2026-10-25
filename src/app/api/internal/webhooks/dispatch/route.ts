import { lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrationAuthCodes } from "@/db/schema";
import { dispatchWebhooks } from "@/lib/integrations/webhooks";
import { isCronCall } from "@/lib/internal-auth";

/**
 * Sends due webhooks, including retries, and purges old authorization codes. Vercel Cron calls it daily
 * (vercel.json, Bearer CRON_SECRET); the worker or an operator can call it
 * any time with Bearer INTERNAL_API_SECRET.
 */
async function handle(request: Request) {
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await dispatchWebhooks(100);
  // Codes live 60 seconds; keep a day for debugging, then drop them.
  const purged = await db
    .delete(integrationAuthCodes)
    .where(lt(integrationAuthCodes.expiresAt, new Date(Date.now() - 24 * 3600_000)))
    .returning({ codeHash: integrationAuthCodes.codeHash });
  return NextResponse.json({ ...result, purgedCodes: purged.length });
}

export const GET = handle;
export const POST = handle;
