// Validates integration settings without revealing them. Used by
// `npm run integrations:check` (local env) and GET /api/internal/integrations/status
// (production, Bearer INTERNAL_API_SECRET). Reports presence, format problems
// and an 8-hex-character SHA-256 fingerprint for secrets that two systems must
// share (compare fingerprints, never values). Pure: no I/O, no server-only.
import { createHash } from "node:crypto";

export type Check = {
  name: string;
  required: boolean;
  present: boolean;
  ok: boolean;
  problems: string[];
  fingerprint?: string;
  note?: string;
};

type Env = Record<string, string | undefined>;

const fp = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 8);
const val = (env: Env, k: string) => env[k]?.trim() || "";

// The ES256 key committed in e2e/support/env.ts: public, so never valid in a real environment.
const TEST_KEY_IDS = new Set(["e2e-test-key", "test-key"]);

const APPS = [
  { id: "COLLABORATE", origin: "https://collaborate.aitathastu.com" },
  { id: "MEET", origin: "https://connect.aitathastu.com" },
];

function secretCheck(env: Env, name: string, required: boolean, minLength: number, note?: string): Check {
  const v = val(env, name);
  const problems: string[] = [];
  if (v && v.length < minLength) problems.push(`shorter than ${minLength} characters`);
  if (v && /\s/.test(v)) problems.push("contains whitespace");
  if (v && /^["'].*["']$/.test(v)) problems.push("wrapped in quotes (paste the value without them)");
  return { name, required, present: Boolean(v), ok: (!required || Boolean(v)) && problems.length === 0, problems, fingerprint: v ? fp(v) : undefined, note };
}

function urlProblems(raw: string, origin: string, label: string) {
  const problems: string[] = [];
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return [`${label} is not an absolute URL`];
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !local) problems.push(`${label} must use https`);
  if (u.hash) problems.push(`${label} must not have a #fragment`);
  if (u.username || u.password) problems.push(`${label} must not contain credentials`);
  if (!local && u.origin !== origin) problems.push(`${label} is not on ${origin}`);
  return problems;
}

export function checkIntegrationConfig(env: Env = process.env): Check[] {
  const checks: Check[] = [];

  // ── Signing key ──
  {
    const name = "INTEGRATION_JWT_PRIVATE_KEY";
    const raw = val(env, name);
    const problems: string[] = [];
    let kid: string | undefined;
    if (raw) {
      try {
        const jwk = JSON.parse(raw) as Record<string, string>;
        kid = jwk.kid;
        if (jwk.kty !== "EC" || jwk.crv !== "P-256") problems.push("must be an EC P-256 key (kty EC, crv P-256)");
        if (!jwk.d) problems.push("is a public key: the private scalar d is missing");
        if (!jwk.x || !jwk.y) problems.push("missing x or y");
        if (!jwk.kid) problems.push("missing kid");
        if (jwk.alg && jwk.alg !== "ES256") problems.push("alg must be ES256");
        if (kid && TEST_KEY_IDS.has(kid)) problems.push("is the public test key from the repository; generate a real one");
      } catch {
        problems.push(raw.startsWith("'") ? "is wrapped in quotes (paste the JSON without them)" : "is not valid JSON");
      }
    }
    checks.push({
      name, required: true, present: Boolean(raw), ok: Boolean(raw) && problems.length === 0, problems,
      note: kid ? `kid ${kid}` : undefined,
    });

    const prevName = "INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS";
    const prev = val(env, prevName);
    const prevProblems: string[] = [];
    let count = 0;
    if (prev) {
      try {
        const keys = JSON.parse(prev) as Record<string, string>[];
        if (!Array.isArray(keys)) prevProblems.push("must be a JSON array");
        else {
          count = keys.length;
          for (const k of keys) {
            if (k.d) prevProblems.push(`key ${k.kid ?? "?"} includes a private part (d); publish public keys only`);
            if (k.kty !== "EC" || k.crv !== "P-256" || !k.kid) prevProblems.push("entries must be EC P-256 public JWKs with a kid");
            if (k.kid && k.kid === kid) prevProblems.push(`kid ${k.kid} duplicates the current key`);
          }
        }
      } catch {
        prevProblems.push("is not valid JSON");
      }
    }
    checks.push({
      name: prevName, required: false, present: Boolean(prev), ok: prevProblems.length === 0, problems: [...new Set(prevProblems)],
      note: prev ? `${count} retired key(s) still published` : "only needed during a key rotation",
    });
  }

  // ── Per app ──
  const secrets = new Map<string, string>(); // fingerprint → variable, to catch reuse
  for (const app of APPS) {
    const p = `INTEGRATION_${app.id}_`;
    const client = secretCheck(env, `${p}CLIENT_SECRET`, false, 32, "required to enable this app; shared with the app's server");
    const webhookUrl = val(env, `${p}WEBHOOK_URL`);
    const webhook = secretCheck(env, `${p}WEBHOOK_SECRET`, Boolean(webhookUrl), 32, "shared with the app's webhook receiver");
    if (webhookUrl && !webhook.present) webhook.problems.push(`required because ${p}WEBHOOK_URL is set`);

    const redirectsRaw = val(env, `${p}REDIRECT_URIS`);
    const redirectProblems: string[] = [];
    let redirectCount = 0;
    if (redirectsRaw) {
      if (redirectsRaw.startsWith("[")) redirectProblems.push("looks like a JSON array; use a comma-separated list of exact URLs");
      else {
        const uris = redirectsRaw.split(",").map((u) => u.trim()).filter(Boolean);
        redirectCount = uris.length;
        uris.forEach((u, i) => redirectProblems.push(...urlProblems(u, app.origin, `URI ${i + 1}`)));
      }
    }
    const webhookProblems = webhookUrl ? urlProblems(webhookUrl, app.origin, "URL") : [];

    for (const c of [client, webhook]) {
      if (!c.fingerprint) continue;
      const other = secrets.get(c.fingerprint);
      if (other) {
        c.problems.push(`same value as ${other}; every secret must be unique`);
        c.ok = false;
      }
      secrets.set(c.fingerprint, c.name);
    }
    if (webhook.problems.length) webhook.ok = false;
    checks.push(
      client,
      {
        name: `${p}REDIRECT_URIS`, required: false, present: Boolean(redirectsRaw), ok: redirectProblems.length === 0, problems: redirectProblems,
        note: redirectsRaw ? `${redirectCount} exact URI(s)` : `unset: any https path on ${app.origin} is accepted (set it to pin the exact callback)`,
      },
      { name: `${p}WEBHOOK_URL`, required: false, present: Boolean(webhookUrl), ok: webhookProblems.length === 0, problems: webhookProblems, note: webhookUrl ? (URL.canParse(webhookUrl) ? new URL(webhookUrl).pathname : undefined) : "push sync off" },
      webhook,
    );
  }

  // ── Shared platform secrets ──
  checks.push(
    secretCheck(env, "CRON_SECRET", false, 16, "Vercel Cron bearer for the daily webhook retry sweep"),
    secretCheck(env, "INTERNAL_API_SECRET", true, 32, "same value on Vercel and Render (compare fingerprints)"),
  );
  return checks;
}
