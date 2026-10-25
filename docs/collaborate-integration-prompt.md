# Prompt: integrate Collaborate with AI Tathastu

Paste everything below the line into the AI coding agent working in the **Collaborate** repository (`collaborate.aitathastu.com`). It contains no secrets: those go in Collaborate's server environment from the separate `.env.collaborate` file.

---

You are working in the **Collaborate** codebase (production: `https://collaborate.aitathastu.com`). Integrate it with **AI Tathastu** (`https://www.aitathastu.com`). AI Tathastu is the identity provider and the source of truth for each user's professional profile.

The full contract is AI Tathastu's integration guide. Its essentials are repeated here. **Inspect this repository first** (framework, auth/session code, user model, profile page, database, deployment) and fit the integration into the existing patterns. Don't invent a parallel auth system. **Keep the existing email/password login working**: AI Tathastu sign-in is added beside it.

## Environment (server-side only; already provided)

```
AIT_ISSUER=https://www.aitathastu.com
AIT_CLIENT_ID=collaborate
AIT_CLIENT_SECRET=…                # never sent to the browser
AIT_REDIRECT_URI=https://collaborate.aitathastu.com/api/auth/tathastu/callback
AIT_AUTHORIZE_URL=https://www.aitathastu.com/integrations/authorize
AIT_TOKEN_URL=https://www.aitathastu.com/api/integrations/sso/token
AIT_PROFILE_URL=https://www.aitathastu.com/api/integrations/v1/profile
AIT_JWKS_URL=https://www.aitathastu.com/api/integrations/jwks
AIT_WEBHOOK_SECRET=…               # never sent to the browser
```

Validate these at startup. Fail fast with a clear message if one is missing. Never log their values, and never give them a client-exposed prefix (`NEXT_PUBLIC_`, `VITE_`, etc.).

## 1. "Sign in with AI Tathastu" (OAuth 2.0 authorization code + PKCE)

Add a button on the sign-in page, and make the existing "Switch Account / SSO" entry use it.

**`GET /api/auth/tathastu/start`**:
1. Generate `state` (32 random bytes, base64url) and a PKCE `code_verifier` (43–128 chars). Compute `code_challenge = BASE64URL(SHA256(code_verifier))`.
2. Store both in a short-lived (10 min), httpOnly, Secure, SameSite=Lax cookie, signed or encrypted with the app's session secret.
3. Redirect (302) to:
   ```
   {AIT_AUTHORIZE_URL}?client_id=collaborate&redirect_uri={AIT_REDIRECT_URI urlencoded}&state={state}&code_challenge={challenge}&code_challenge_method=S256
   ```
   Add `&prompt=consent` when the user explicitly wants to change what they share.

**`GET /api/auth/tathastu/callback`** must exist at exactly this path; it's registered with AI Tathastu.
1. If `error` is present (`access_denied`, `temporarily_unavailable`, …), send the user back to sign-in with a friendly message.
2. Require `state` to equal the cookie's value (constant-time compare). Otherwise reject with 400. Clear the cookie in all cases.
3. Exchange the code **server-side**:
   ```http
   POST {AIT_TOKEN_URL}
   Authorization: Basic base64(urlencode(AIT_CLIENT_ID) + ":" + urlencode(AIT_CLIENT_SECRET))
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&code={code}&redirect_uri={AIT_REDIRECT_URI}&code_verifier={verifier}
   ```
   Codes are single-use and expire in 60 seconds, so exchange immediately and never retry with the same code.
   The response is `{ access_token, token_type: "Bearer", expires_in: 900, scope: "profile:read", user: { id, email, name } }`.
4. **Verify the JWT**, even though it came over TLS. Use the JWKS (e.g. `jose`'s `createRemoteJWKSet(new URL(AIT_JWKS_URL))` and `jwtVerify`) with `issuer = AIT_ISSUER`, `audience = "collaborate"`, `algorithms = ["ES256"]`. Pick the key by `kid`; the JWKS can hold several during rotation. Reject anything else.
5. Find or create the Collaborate user by **`sub` (AI Tathastu user id)**, stored in a new unique column such as `users.tathastu_user_id`. Never match by email alone.
   - If a different, already-signed-in Collaborate account is linking, link that account.
   - If an existing account has the same verified email and no link yet, ask the user to confirm the link (sign in with password once) rather than merging silently.
6. Create the normal Collaborate session (the same mechanism as password login). **Don't use the 15-minute access token as the session.**
7. Fetch the profile (§2), save it, then redirect to the profile or home.

## 2. Read and store the profile

```http
GET {AIT_PROFILE_URL}
Authorization: Bearer {access_token}
```

| Status | Meaning |
| --- | --- |
| 200 | `ProfessionalProjectionV1` |
| 304 | Unchanged (if you send `If-None-Match`) |
| 401 | Token invalid or expired, or the user disconnected Collaborate |
| 403 | Integration switched off |
| 503 | Retry after `Retry-After` |

The shape:

```jsonc
{ "schema": "ProfessionalProjectionV1", "version": 1, "audience": "collaborate", "generatedAt": "…",
  "identity": { "id", "email", "name", "headline", "avatarUrl", "careerRole": { "id", "label" } | null,
                "careerRoleOther", "location": { "city", "country" }, "university" },
  "education":   [ { "institution", "degree", "fieldOfStudy", "dates", "grade", "sources": [] } ] | null,
  "skills":      { "items": [ { "name", "category", "evidenceStrength", "verified", "verificationStatus", "sources": [] } ],
                   "erisReadiness": { "score" (0–1), "role", "byRole", "gaps": [ { "skill", "readiness", "weight" } ], "computedAt" } | null } | null,
  "projects":    [ { "key", "title", "description", "technologies": [], "links": [], "status", "sources": [] } ] | null,
  "experience":  [ { "organization", "role", "dates", "description", "sources": [] } ] | null,
  "achievements":[ { "type": "achievement"|"certification"|"publication", "title", "issuer", "date", "description", "url", "sources": [] } ] | null,
  "activity":    { "connectedSources": [], "github": { "repositories", "recent": [ { "name", "url", "stars", "languages": [], "lastCommitAt" } ] }, "profileUpdatedAt" } | null,
  "privacy":     { "scopes": { "skills", "projects", "eris", "experience", "education", "achievements", "activity" }, "masked": [], "hiddenProjects", "consentUpdatedAt" } }
```

Rules:

- **`null` means "not shared", not "empty".** Every optional section starts off for a new user, so expect `null` often. When a section becomes `null`, **delete** what you stored from it.
- Store the latest projection per user (e.g. a `tathastu_profiles` table: `user_id`, `projection jsonb`, `generated_at`, `updated_at`), plus columns you need for search (skills names, role). Upsert projects by `key`.
- Map it onto the existing profile page:
  - **Header:** name, headline, location and avatar from `identity`. The role badge is `careerRole.label`, falling back to `careerRoleOther`.
  - **Stat row:**
    - Projects: `projects.length`
    - Skills: `skills.items.length`
    - Achievements: count of `achievements` where `type !== "publication"`
    - Publications: count where `type === "publication"`
    - GitHub contributions: `activity.github.repositories`
    - LeetCode problems: parse the achievement whose `sources` include `leetcode`
    - Show "—" with a tooltip "Not shared from AI Tathastu" when the section is `null`, never 0.
  - **Tabs:** Projects, Skills, Experience and Education from the matching sections. Activity comes from `activity.github.recent`.
  - **"AI Tathastu Insights":** only when `skills.erisReadiness` is present. Show the score as `round(score*100)/100` for `role`, plus the top `gaps`. Otherwise show "Share your ERIS readiness from AI Tathastu to see insights", linking to `{AIT_AUTHORIZE_URL}…&prompt=consent`.
  - Mark verified skills (`verified: true`) with a small badge.
- The **"AI Tathastu Sync" button** sends the user through `/api/auth/tathastu/start`. It's instant for an already-approved user: no screen, just a fresh code. The callback then re-fetches and saves the profile. Show "Synced just now".

## 3. Webhook receiver

**`POST /api/webhooks/tathastu`** must exist at exactly this path; it's registered with AI Tathastu.

```
X-AIT-Event: profile.updated | integration.revoked
X-AIT-Delivery: <uuid>            # unique per event; retries reuse it
X-AIT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(AIT_WEBHOOK_SECRET, "<t>.<raw body>")>
Body: { "id", "type", "createdAt", "data": { "userId", "reason"?, "profile"? } }
```

1. **Read the raw body bytes before any JSON parsing.** In Fastify, register a raw-body parser for this route (e.g. `addContentTypeParser('application/json', { parseAs: 'buffer' }, …)` scoped to the route, or `fastify-raw-body`). In Next.js route handlers, use `await req.text()`. In Express, use `express.raw({ type: 'application/json' })`.
2. Parse `t` and `v1`. Reject with 401 if the format is wrong, if `|now − t| > 300` seconds, or if the HMAC doesn't match. Compare with `crypto.timingSafeEqual`.
3. **Idempotency:** insert `X-AIT-Delivery` into a `tathastu_webhook_deliveries(delivery_id primary key, received_at)` table. On conflict, return 200 and do nothing.
4. Find the user by `data.userId` (= `tathastu_user_id`). If unknown, return 200 and ignore it.
5. `profile.updated`: replace the stored projection with `data.profile`, applying the same `null` rules as above. It's always the full current profile, already filtered by the user's consent; never merge it into old data.
6. `integration.revoked`: delete the stored projection and derived columns, unlink `tathastu_user_id` (keep the Collaborate account and its password login), and end the user's Tathastu-based sessions.
7. Respond **2xx within 10 seconds**. If the work is heavy, queue it after the idempotency insert. Return a 5xx only for real failures. AI Tathastu retries after 1 min, then 5 min, 30 min, 2 h and 12 h, and doesn't follow redirects.

## 4. Security checklist

- `AIT_CLIENT_SECRET` and `AIT_WEBHOOK_SECRET` are server-only, never logged and never in client bundles.
- `state` and PKCE on every sign-in; exact `redirect_uri`; codes never reused.
- JWT verified via JWKS with ES256, `iss`, `aud = collaborate` and `exp`; key chosen by `kid`.
- Users keyed by `sub`, not email; no silent account merges.
- Webhook HMAC over the raw body, 5-minute window, dedupe by delivery id.
- Rate-limit `/api/auth/tathastu/*` and the webhook route.
- No profile data cached in the browser beyond what the page renders.

## 5. Tests (must pass before deploying)

**Unit tests:**
- callback rejects a missing or mismatched `state`
- PKCE values are well formed
- JWT verification rejects the wrong `aud`, the wrong `iss`, HS256, an expired token and an unknown `kid` (use a locally generated ES256 key and a mocked JWKS)
- webhook verification accepts a correct signature and rejects a tampered body, an old timestamp and a bad format
- duplicate delivery ids are ignored
- `null` sections delete stored data
- `integration.revoked` unlinks the account

**Integration test:** mock the three AI Tathastu endpoints. Start → callback → token → profile saved → page shows it.

**Regression:** existing email/password sign-up and login still work.

## 6. Deploy and verify (production)

1. Set the env vars above on Collaborate's server and deploy.
2. `curl -i https://collaborate.aitathastu.com/api/webhooks/tathastu -X POST -d '{}'` must return **401** (route exists, signature required), not 404.
3. `curl -i "https://collaborate.aitathastu.com/api/auth/tathastu/callback"` must return 400 or a redirect (route exists), not 404.
4. Tell the AI Tathastu team. They enable the `collaborate_profile_api` flag.
5. With a test account:
   1. Sign in with AI Tathastu; the approval screen appears and everything is off by default. Turn on skills and projects.
   2. Check you're back on Collaborate, signed in, with skills and projects shown and the other sections showing "not shared".
   3. In AI Tathastu → Settings → Integrations → Collaborate: turn on ERIS, press **Sync profile**, and see Insights appear on Collaborate.
   4. Press **Disconnect** there; Collaborate's stored Tathastu data is removed.
   5. Check that password login still works.

Report back: the files changed, migrations added, test results, and the production checks above.
