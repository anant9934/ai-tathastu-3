import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { importJWK, jwtVerify, SignJWT, type JWK, type JWTVerifyGetKey } from "jose";

import type { IntegrationClientId } from "@/db/schema";
import { INTEGRATION_CLIENTS } from "@/lib/integrations/clients";

/**
 * Access tokens for integrated apps: ES256 JWTs, 15 minutes, audience = the
 * app. Asymmetric on purpose: apps verify tokens with the public key from
 * /api/integrations/jwks but can't mint them, so Collaborate can never forge
 * a token for Meet (a shared HS256 secret would allow exactly that).
 *
 * INTEGRATION_JWT_PRIVATE_KEY: the current private EC P-256 key as a JWK
 *   (JSON) with a "kid". Generate with: node scripts/integration-key.mjs
 * INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS: optional JSON array of retired
 *   public JWKs, kept in the JWKS during a rotation so tokens and cached key
 *   sets in the apps keep verifying. See DEPLOYMENT.md, "Rotating the signing key".
 */

export const TOKEN_TTL_SECONDS = 15 * 60;
export const ISSUER = "https://www.aitathastu.com";
export const TOKEN_SCOPE = "profile:read";

type KeySet = { privateKey: CryptoKey; kid: string; publicJwks: JWK[]; verifyKey: JWTVerifyGetKey };
let cached: Promise<KeySet> | null = null;

const publicPart = (jwk: JWK): JWK => ({ kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, kid: jwk.kid, alg: "ES256", use: "sig" });

/** Parses and checks the key settings; throws messages that never contain key material. */
export function parseKeyConfig(env: Record<string, string | undefined> = process.env) {
  const raw = env.INTEGRATION_JWT_PRIVATE_KEY;
  if (!raw) throw new Error("INTEGRATION_JWT_PRIVATE_KEY is not set");
  let jwk: JWK;
  try {
    jwk = JSON.parse(raw) as JWK;
  } catch {
    throw new Error("INTEGRATION_JWT_PRIVATE_KEY is not valid JSON");
  }
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y || !jwk.kid) {
    throw new Error("INTEGRATION_JWT_PRIVATE_KEY must be an EC P-256 private JWK with d, x, y and kid");
  }
  let previous: JWK[] = [];
  if (env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS?.trim()) {
    try {
      previous = JSON.parse(env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS) as JWK[];
    } catch {
      throw new Error("INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS is not valid JSON");
    }
    if (!Array.isArray(previous)) throw new Error("INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS must be a JSON array");
    for (const k of previous) {
      if (k.d) throw new Error("INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS must not contain private keys (d)");
      if (k.kty !== "EC" || k.crv !== "P-256" || !k.x || !k.y || !k.kid) {
        throw new Error("INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS entries must be EC P-256 public JWKs with a kid");
      }
    }
  }
  const kids = [jwk.kid, ...previous.map((k) => k.kid)];
  if (new Set(kids).size !== kids.length) throw new Error("Signing key ids (kid) must be unique");
  return { privateJwk: jwk, previous: previous.map(publicPart) };
}

function keys(): Promise<KeySet> {
  cached ??= (async () => {
    const { privateJwk, previous } = parseKeyConfig();
    const privateKey = (await importJWK(privateJwk, "ES256")) as CryptoKey;
    const publicJwks = [publicPart(privateJwk), ...previous];
    const byKid = new Map(
      await Promise.all(publicJwks.map(async (k) => [k.kid!, (await importJWK(k, "ES256")) as CryptoKey] as const)),
    );
    // Tokens name their key; only published keys verify.
    const verifyKey: JWTVerifyGetKey = async (header) => {
      const key = header.kid ? byKid.get(header.kid) : undefined;
      if (!key) throw new Error("unknown kid");
      return key;
    };
    return { privateKey, kid: privateJwk.kid!, publicJwks, verifyKey };
  })();
  cached.catch(() => (cached = null));
  return cached;
}

export function isIntegrationKeyConfigured() {
  return Boolean(process.env.INTEGRATION_JWT_PRIVATE_KEY);
}

export async function publicJwks() {
  return { keys: (await keys()).publicJwks };
}

export async function mintAccessToken(input: { userId: string; email: string | null; name: string | null; clientId: IntegrationClientId }) {
  const { privateKey, kid } = await keys();
  const expiresIn = TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ email: input.email, name: input.name, scope: TOKEN_SCOPE })
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(input.clientId)
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .setJti(crypto.randomUUID())
    .sign(privateKey);
  return { token, expiresIn };
}

/** Claims if the token is ours (current or a still-published previous key), unexpired, for a registered app and the right scope; else null. */
export async function verifyAccessToken(token: string) {
  try {
    const { verifyKey } = await keys();
    const { payload } = await jwtVerify(token, verifyKey, {
      issuer: ISSUER,
      audience: INTEGRATION_CLIENTS.map((c) => c.id),
      algorithms: ["ES256"],
    });
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (aud.length !== 1 || payload.scope !== TOKEN_SCOPE || typeof payload.sub !== "string") return null;
    return { userId: payload.sub, clientId: aud[0] as IntegrationClientId };
  } catch {
    return null;
  }
}

// ─── Authorization codes ────────────────────────────────────────────────────

export const CODE_TTL_SECONDS = 60;

export const newAuthCode = () => randomBytes(32).toString("base64url");
export const hashCode = (code: string) => createHash("sha256").update(code).digest("base64url");

/** PKCE S256: BASE64URL(SHA256(verifier)) === challenge. */
export const pkceMatches = (verifier: string, challenge: string) =>
  createHash("sha256").update(verifier).digest("base64url") === challenge;
