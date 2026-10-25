/**
 * Security tests for the Profile API (plan §4.5 / Phase 4 gate):
 * no user can read another user's profile (IDOR), unauthenticated calls get
 * 401, disabled integrations get 403, and embed tokens are scoped, origin-bound,
 * short-lived and can't be forged or used to mint new tokens.
 *
 * Real route handlers + real Postgres (PGlite, all migrations); only the
 * Auth.js session lookup is stubbed.
 */
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://pilot.example.edu";
process.env.EMBED_JWT_SECRET = "test-embed-secret-0123456789abcdefghijkl";
process.env.EMBED_ALLOWED_ORIGINS = `${ORIGIN},https://other-allowed.example`;
process.env.AUTH_SECRET = "test-auth-secret-different-from-embed-000";

const state = vi.hoisted(() => ({ sessionUserId: null as string | null }));

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/auth", () => ({
  auth: async () => (state.sessionUserId ? { user: { id: state.sessionUserId } } : null),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { GET, OPTIONS } = await import("./route");
const tokenRoute = await import("@/app/api/auth/embed-token/route");
const { mintEmbedToken } = await import("@/lib/embed-token");

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

async function seedUser(id: string, name: string, email: string) {
  await db.insert(schema.users).values({ id, name, email, university: `${name} University` });
  await db.insert(schema.onboardingState).values({ userId: id, currentStep: "done", careerRole: "ml_engineer" });
  await db.insert(schema.profileFacts).values({
    userId: id, fieldGroup: "identity", fieldName: "full_name", extractedValue: name, normalizedValue: name,
    origin: "user_entered", confirmation: "confirmed",
  });
  await db.insert(schema.profileViews).values({
    userId: id,
    view: {
      version: 1, skills: [{ name: `${name}-Skill`, category: "other", evidenceStrength: 0.9, sources: ["resume"], verificationStatus: "verified" }],
      erisScore: { overall: id === A ? 0.42 : 0.91, byRole: {}, gaps: [] }, readinessIndicators: { profileComplete: 0.5 },
    },
  });
}

async function setFlag(key: string, enabled: boolean) {
  await db.update(schema.featureFlags).set({ enabled }).where(eq(schema.featureFlags.key, key));
}

function req(opts: { headers?: Record<string, string>; query?: string } = {}) {
  return new Request(`https://www.aitathastu.com/api/profile/v1/me${opts.query ?? ""}`, { headers: opts.headers });
}

beforeAll(async () => {
  await seedUser(A, "Alice", "alice@example.com");
  await seedUser(B, "Bob", "bob@example.com");
});

beforeEach(async () => {
  state.sessionUserId = null;
  for (const f of ["avasar_profile_api", "learn_profile_api", "pilot_site_embed"]) await setFlag(f, true);
});

describe("authentication", () => {
  it("401 with no session and no token", async () => {
    const res = await GET(req({ headers: { "x-ait-module": "avasar" } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthenticated" });
  });

  it("401 with a garbage bearer token", async () => {
    const res = await GET(req({ headers: { authorization: "Bearer not-a-jwt" } }));
    expect(res.status).toBe(401);
  });
});

describe("feature flags", () => {
  it("403 when the calling module's flag is off", async () => {
    state.sessionUserId = A;
    await setFlag("avasar_profile_api", false);
    const res = await GET(req({ headers: { "x-ait-module": "avasar" } }));
    expect(res.status).toBe(403);
    // other modules are unaffected
    expect((await GET(req({ headers: { "x-ait-module": "learn" } }))).status).toBe(200);
  });

  it("400 when the caller doesn't declare a known module", async () => {
    state.sessionUserId = A;
    expect((await GET(req())).status).toBe(400);
    expect((await GET(req({ headers: { "x-ait-module": "unknown" } }))).status).toBe(400);
  });

  it("403 for embed tokens when pilot_site_embed is off", async () => {
    const { token } = await mintEmbedToken(A, ORIGIN);
    await setFlag("pilot_site_embed", false);
    const res = await GET(req({ headers: { authorization: `Bearer ${token}`, origin: ORIGIN } }));
    expect(res.status).toBe(403);
  });

  it("a flag missing from the table counts as off", async () => {
    state.sessionUserId = A;
    await db.delete(schema.featureFlags).where(eq(schema.featureFlags.key, "learn_profile_api"));
    expect((await GET(req({ headers: { "x-ait-module": "learn" } }))).status).toBe(403);
    await db.insert(schema.featureFlags).values({ key: "learn_profile_api", enabled: true });
  });
});

describe("IDOR: user A can never read user B", () => {
  it("session for A returns A's full profile and nothing of B's", async () => {
    state.sessionUserId = A;
    const res = await GET(req({ headers: { "x-ait-module": "avasar" }, query: `?module=avasar&userId=${B}&user=${B}` }));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(JSON.parse(body).identity.name).toBe("Alice");
    expect(body).not.toContain("Bob");
    expect(body).not.toContain(B);
  });

  it("session for B returns B (the endpoint follows the session, not input)", async () => {
    state.sessionUserId = B;
    const body = await (await GET(req({ headers: { "x-ait-module": "avasar" } }))).json();
    expect(body.identity.name).toBe("Bob");
  });

  it("embed token for A returns only A's compact view, even with B's session cookie present", async () => {
    state.sessionUserId = B; // bearer wins; the cookie can't widen or switch identity
    const { token } = await mintEmbedToken(A, ORIGIN);
    const res = await GET(req({ headers: { authorization: `Bearer ${token}`, origin: ORIGIN } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      name: "Alice", careerRole: "ML Engineer", erisScore: 0.42, topSkills: ["Alice-Skill"],
      dashboardUrl: "https://www.aitathastu.com/dashboard",
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("a token re-signed to claim B's id without the embed secret is rejected", async () => {
    const forged = await new SignJWT({ scope: "profile:read:embed", origin: ORIGIN })
      .setProtectedHeader({ alg: "HS256" }).setSubject(B).setIssuer("aitathastu").setAudience("ait-embed")
      .setIssuedAt().setExpirationTime("10m")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET)); // the session secret is not the embed secret
    const res = await GET(req({ headers: { authorization: `Bearer ${forged}`, origin: ORIGIN } }));
    expect(res.status).toBe(401);
  });

  it("an unsigned (alg=none) token claiming B is rejected", async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${enc({ alg: "none", typ: "JWT" })}.${enc({ sub: B, scope: "profile:read:embed", origin: ORIGIN, iss: "aitathastu", aud: "ait-embed", exp: Math.floor(Date.now() / 1000) + 600 })}.`;
    expect((await GET(req({ headers: { authorization: `Bearer ${none}`, origin: ORIGIN } }))).status).toBe(401);
  });
});

describe("embed token scope", () => {
  it("expired tokens are rejected", async () => {
    const expired = await new SignJWT({ scope: "profile:read:embed", origin: ORIGIN })
      .setProtectedHeader({ alg: "HS256" }).setSubject(A).setIssuer("aitathastu").setAudience("ait-embed")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600).setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.EMBED_JWT_SECRET));
    expect((await GET(req({ headers: { authorization: `Bearer ${expired}`, origin: ORIGIN } }))).status).toBe(401);
  });

  it("a token minted for one site can't be used from another (origin-bound)", async () => {
    const { token } = await mintEmbedToken(A, ORIGIN);
    const res = await GET(req({ headers: { authorization: `Bearer ${token}`, origin: "https://other-allowed.example" } }));
    expect(res.status).toBe(401);
  });

  it("tokens expire after 15 minutes", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { expiresAt } = await mintEmbedToken(A, ORIGIN);
    expect(expiresAt - before).toBeGreaterThanOrEqual(15 * 60 - 1);
    expect(expiresAt - before).toBeLessThanOrEqual(15 * 60 + 1);
  });

  it("CORS preflight only for allowed origins", async () => {
    const ok = OPTIONS(new Request("https://www.aitathastu.com/api/profile/v1/me", { method: "OPTIONS", headers: { origin: ORIGIN } }));
    expect(ok.status).toBe(204);
    const bad = OPTIONS(new Request("https://www.aitathastu.com/api/profile/v1/me", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(bad.status).toBe(403);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("GET /api/auth/embed-token", () => {
  const mint = (origin: string, headers: Record<string, string> = {}) =>
    tokenRoute.GET(new Request(`https://www.aitathastu.com/api/auth/embed-token?origin=${encodeURIComponent(origin)}`, { headers }));

  it("401 without a session, even when presenting a valid embed token (tokens can't mint tokens)", async () => {
    const { token } = await mintEmbedToken(A, ORIGIN);
    expect((await mint(ORIGIN, { authorization: `Bearer ${token}` })).status).toBe(401);
  });

  it("mints a token for the session user only, bound to the requested allowed origin", async () => {
    state.sessionUserId = A;
    const res = await mint(ORIGIN);
    expect(res.status).toBe(200);
    const { token } = await res.json();
    const me = await (await GET(req({ headers: { authorization: `Bearer ${token}`, origin: ORIGIN } }))).json();
    expect(me.name).toBe("Alice");
  });

  it("400 for origins that aren't allow-listed", async () => {
    state.sessionUserId = A;
    expect((await mint("https://evil.example")).status).toBe(400);
  });

  it("403 when the embed is switched off", async () => {
    state.sessionUserId = A;
    await setFlag("pilot_site_embed", false);
    expect((await mint(ORIGIN)).status).toBe(403);
  });
});
