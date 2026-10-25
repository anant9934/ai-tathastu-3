import { connection, NextResponse, type NextRequest } from "next/server";

import { auth, unstable_update } from "@/auth";

/**
 * Re-derives the JWT `onboarded` claim from the database, then continues to
 * the dashboard. Used whenever the server knows onboarding is done but the
 * cookie might not (see FINISHED_REDIRECT in src/lib/dal.ts).
 */
export async function GET(request: NextRequest) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", request.url));
  await unstable_update({});
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
