import { after, connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { searchInstitutions } from "@/lib/academic/catalog";
import { logEvent } from "@/lib/analytics";

/**
 * GET /api/academic/institutions?q= — verified institutions matching a name
 * or alias ("LPU", "iit bombay"), best first. For the Step 3 combobox, which
 * debounces its calls. Signed-in users only.
 */
export async function GET(request: Request) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ results: [] });
  const results = await searchInstitutions(q);

  const userId = session.user.id;
  after(async () => {
    await logEvent("institution_search", { queryLength: q.length, results: results.length }, userId);
    // The query text is kept only when nothing matched: it shows what's missing from the catalogue.
    if (!results.length) await logEvent("search_no_results", { query: q.slice(0, 60) }, userId);
  });
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, max-age=60" } });
}
