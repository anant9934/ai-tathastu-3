// Generates the EC P-256 signing key for integration access tokens.
//   node scripts/integration-key.mjs
// Prints INTEGRATION_JWT_PRIVATE_KEY='<jwk>' for .env.local / Vercel. The
// public half is served at /api/integrations/jwks; apps never need this value.
import { exportJWK, generateKeyPair } from "jose";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = { ...(await exportJWK(privateKey)), kid: `ait-${new Date().toISOString().slice(0, 10)}`, alg: "ES256" };
console.log(`INTEGRATION_JWT_PRIVATE_KEY='${JSON.stringify(jwk)}'`);
