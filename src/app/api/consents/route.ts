import { NextResponse } from "next/server";

import { appendConsents, consentChoicesSchema } from "@/lib/consent/store";
import { getApiUserAtStep } from "@/lib/dal";

/** Saves the user's consent choices (append-only; unchanged answers add no rows). */
export async function POST(request: Request) {
  const authz = await getApiUserAtStep("review");
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const parsed = consentChoicesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent choices." }, { status: 422 });

  const { appended } = await appendConsents(authz.user.id, parsed.data);
  return NextResponse.json({ ok: true, appended });
}
