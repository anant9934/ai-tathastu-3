import { NextResponse, type NextRequest } from "next/server";

import { getApiUserAtStep } from "@/lib/dal";
import { connectSource } from "@/lib/connectors/connections";
import { exchangeOrcidCode, ORCID_STATE_COOKIE, orcidCallbackUrl } from "@/lib/connectors/orcid";
import { connectorReturnPath, parseConnectorContext, type ConnectorContext } from "@/lib/connectors/sources";
import { safeEqual } from "@/lib/internal-auth";

function finish(request: NextRequest, query: string, from: ConnectorContext) {
  const res = NextResponse.redirect(new URL(`${connectorReturnPath(from)}?source=orcid&${query}`, request.url));
  res.cookies.delete({ name: ORCID_STATE_COOKIE, path: "/api/connectors/orcid" });
  return res;
}

/**
 * ORCID redirects here after sign-in. Verifies state (CSRF), exchanges the
 * code for the authenticated ORCID iD, stores only the iD, and queues the
 * public-record sync.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(ORCID_STATE_COOKIE)?.value ?? "";
  const [cookieUser, cookieState, rawFrom] = cookie.split(".");
  const from = parseConnectorContext(rawFrom);
  const authz = await getApiUserAtStep(from === "research" ? "research_expertise" : "connectors", { allowDone: true });
  if (!authz.ok) return NextResponse.redirect(new URL(authz.status === 401 ? "/login" : "/onboarding", request.url));

  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  if (!cookieState || cookieUser !== authz.user.id || !safeEqual(cookieState, state)) return finish(request, "error=state", from);
  if (params.get("error")) return finish(request, params.get("error") === "access_denied" ? "error=denied" : "error=orcid", from);
  const code = params.get("code");
  if (!code) return finish(request, "error=orcid", from);

  try {
    const { orcid, name } = await exchangeOrcidCode(code, orcidCallbackUrl(request.nextUrl.origin));
    await connectSource({
      userId: authz.user.id,
      sourceId: "orcid",
      accessMethod: "oauth",
      credential: { orcid, name },
      syncKey: state,
    });
  } catch (error) {
    console.error("ORCID connect failed", error);
    return finish(request, "error=orcid", from);
  }
  return finish(request, "connected=1", from);
}
