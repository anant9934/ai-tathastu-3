// Checks integration settings without printing them.
//
//   npm run integrations:check                 # .env.local (or the environment)
//   npm run integrations:check -- --remote     # the deployed app, via
//                                              # /api/internal/integrations/status
//
// --remote uses INTERNAL_API_SECRET from .env.local and APP_URL (default
// https://www.aitathastu.com). Exit 1 if anything required is missing or malformed.
import { config } from "dotenv";

import { checkIntegrationConfig, type Check } from "../src/lib/integrations/config-check";

config({ path: ".env.local", quiet: true });

function print(checks: Check[]) {
  for (const c of checks) {
    const state = !c.present ? (c.required ? "MISSING" : "unset  ") : c.ok ? "ok     " : "INVALID";
    const extra = [c.fingerprint && `fp ${c.fingerprint}`, c.note, ...c.problems].filter(Boolean).join(" · ");
    console.log(`${state}  ${c.name.padEnd(42)} ${extra}`);
  }
}

async function main() {
  if (process.argv.includes("--remote")) {
    const base = (process.env.APP_URL || "https://www.aitathastu.com").replace(/\/$/, "");
    const res = await fetch(`${base}/api/internal/integrations/status`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_SECRET ?? ""}` },
    });
    if (!res.ok) {
      console.error(`${base}: HTTP ${res.status}${res.status === 404 ? " (status endpoint not deployed yet)" : res.status === 401 ? " (INTERNAL_API_SECRET differs from the deployment's)" : ""}`);
      return 1;
    }
    const body = await res.json();
    console.log(`${base} · deployment ${body.deployment ?? "?"} · signing key ${body.signingKey.loads ? `loads (${body.signingKey.kids.join(", ")})` : `FAILS: ${body.signingKey.error}`}`);
    console.log(`flags: ${Object.entries(body.flags).map(([k, v]) => `${k}=${v ? "on" : "off"}`).join(", ")}\n`);
    print(body.checks);
    return body.ok ? 0 : 1;
  }
  const checks = checkIntegrationConfig();
  print(checks);
  return checks.every((c) => c.ok) ? 0 : 1;
}

main().then((code) => process.exit(code));
