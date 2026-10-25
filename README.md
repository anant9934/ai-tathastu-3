# ai-tathastu-3

Next.js 16 (App Router, Cache Components) · Auth.js v5 · Drizzle + Neon · Tailwind v4 + shadcn/ui.
Product spec: [AI Tathastu Implementation Plan.md](./AI%20Tathastu%20Implementation%20Plan.md).

## Setup

```bash
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, OAuth + Resend keys
npm install
npm run db:migrate           # applies src/db/migrations to DATABASE_URL (Postgres port 5432)
npm run db:migrate:http      # same, over Neon's HTTPS endpoint, for networks that block 5432
npm run dev
```

Sign-in methods appear only when configured: Google / LinkedIn need their client ID and secret; the email magic link uses Resend if `RESEND_API_KEY` is set, otherwise SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, e.g. a Gmail app password).

Worker (separate terminal): see [worker/README.md](./worker/README.md). It needs `GROQ_KEYS` for LLM recovery, and Tesseract for scanned resumes.

After changing `src/db/schema.ts`: `npm run db:generate` creates a new SQL migration; review it, then `npm run db:migrate`.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/auth.ts`, `src/auth.config.ts` | Auth.js: Google, LinkedIn OIDC, Resend magic link. JWT sessions; users/accounts in Postgres via the Drizzle adapter. |
| `src/proxy.ts` | Next 16's renamed middleware. Optimistic gate only (JWT cookie, no DB). |
| `src/lib/dal.ts` | Data Access Layer. `requireOnboardingStep()` is the real guard for every onboarding page and Server Action. |
| `src/lib/onboarding/` | Step order and the role/priority catalogues (client-safe). |
| `src/app/onboarding/actions.ts` | Server Actions: autosave per step, `continueFromStep`, `submitBasicProfile`. |
| `src/db/schema.ts` | Phase 1 tables: `users`, `consents`, `onboarding_state`, `profile_facts`, `files`, `jobs`, plus Auth.js tables. |
| `src/app/api/upload/resume/` | Presigned R2 PUT (`route.ts`), then verify and enqueue (`complete/route.ts`). |
| `src/app/api/jobs/[id]/route.ts` | Owner-scoped job status, ETag/304 for polling. |
| `worker/` | Python job runner: resume pipeline, GitHub sync, `compute_intelligence`. |
| `src/lib/connectors/` | Source catalogue, `connectSource`/`disconnectSource`, AES-256-GCM token sealing, GitHub OAuth helpers. |
| `src/app/api/connectors/github/` | GitHub connector OAuth (`start`, `callback`). Separate from sign-in. |
| `src/app/api/consents/route.ts` | Append-only consent writes. |
| `src/app/api/session/refresh/route.ts` | Re-derives the JWT `onboarded` claim, then goes to `/dashboard`. |

## Onboarding rules

- `onboarding_state.current_step` is the furthest step reached. `/onboarding` redirects there.
- Users can revisit any earlier step; requesting a later one redirects back to `current_step`.
- Every choice saves immediately. "Continue" re-validates what is stored in the database before advancing.
- Step 3 writes `identity` rows to `profile_facts` (`origin = user_entered`, `confirmation = confirmed`). A changed value inserts a new row and sets `superseded_by` on the old one.

## Resume upload flow

1. The browser hashes the file (SHA-256) and `POST`s `/api/upload/resume` with name, size, type and hash. If those bytes were uploaded before, the existing job is returned and no upload happens.
2. Otherwise the server returns a presigned PUT signed over `content-type`, `content-length` and `x-amz-checksum-sha256`, so R2 accepts only those exact bytes. The file goes browser → R2 and never passes through a Vercel function.
3. `POST /api/upload/resume/complete` checks the object with a HEAD (size, type, checksum), then inserts `files` and a `resume_extract` job. The idempotency key is `resume_extract:{user}:{sha256}:v1`.
4. The client polls `/api/jobs/:id` (2 s → 4 → 8 → 10 s max, `If-None-Match`).

### R2 bucket CORS (required for browser uploads)

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "x-amz-checksum-sha256"],
    "MaxAgeSeconds": 3600
  }
]
```

## Review rules

`/onboarding/resume/review` lists `origin = resume`, `confirmation = unconfirmed` facts, lowest confidence first. On save:

- Approved, unchanged → `confirmed`.
- Approved but edited → `edited`; `normalized_value` holds the user's text and `extracted_value` keeps the original.
- Rejected → `rejected`.
- Added by hand → new rows with `origin = user_entered`, `confirmation = confirmed`.
- Undecided → stays `unconfirmed`.

Downstream code should treat `confirmed` and `edited` as user-approved.

## Connectors (Step 5)

- **GitHub:** a GitHub OAuth App (Settings → Developer settings → OAuth Apps) with callback `http://localhost:3000/api/connectors/github/callback`. The scope is `read:user`: public profile and public repos. `state` is checked against an httpOnly cookie bound to the user.
- **Kaggle:** username and key from `kaggle.json`. **Stack Exchange:** profile URL; the API only needs our app key. **Portfolio:** a public URL.
- **LinkedIn:** linking LinkedIn sign-in records the Tier 1 connection (`events.linkAccount`). There's nothing to sync.
- Credentials are sealed into `connections.token_enc` (see `src/lib/connectors/crypto.ts`); the worker opens them with `worker/crypto_box.py`. Both sides need the same `CONNECTOR_TOKEN_KEY`.
- Connecting queues `connector_sync` with `{ source_id, connection_id }`. "Disconnect" removes the connection, cancels its queued syncs, deletes that source's facts, and revokes the GitHub grant.

## Finishing onboarding (Step 6)

Consents autosave through `POST /api/consents`, which only appends a row when an answer or the policy version changes. "Generate my profile" sets `current_step = done` and `consents_completed = true`, queues `compute_intelligence`, refreshes the session claim, and redirects to `/dashboard`.

The proxy gates `/dashboard` on the JWT's `onboarded` claim, with no DB query. The dashboard page re-checks `onboarding_state`.

## Intelligence output

`compute_intelligence` rewrites `skill_evidence`, `unified_projects`, `eris_scores` and `profile_views` for one user in a single transaction. `profile_views.view` is the document the dashboard will render (Phase 3); its top-level keys are `identity`, `goals`, `skills`, `projects`, `erisScore`, `readinessIndicators` and `widgets`, the last ordered by P(w) with per-widget `components`, `state` and `data`. Widget ids in `worker/intelligence/config.py` must match the Phase 3 TypeScript registry.

## Dashboard (Phase 3)

- `src/lib/dashboard/widgets.ts` is the widget registry: id, module, label, intent, required data, `eligibility`, primary action, freshness source, size, and empty-state copy. Its ids must exist in `worker/intelligence/config.py`; `worker/tests` fails if they drift.
- `src/lib/dashboard/compose.ts` takes `profile_views.view` (already ordered by P(w)) and applies `widget_prefs`: dismissed widgets are hidden, pinned ones go first. It does no scoring. Prefs are applied at read time, so a click takes effect without a recompute.
- `src/app/(dashboard)/layout.tsx` holds the persistent nav for the dashboard and every module page. Module pages without a build yet render `src/app/(dashboard)/[module]/page.tsx`.
- Each widget renders inside `WidgetWrapper` (header, pin/dismiss, primary action), then an error boundary, then Suspense. States are loading (skeleton), empty (eligibility fails or no data), partial, stale (with a GitHub "Refresh" that queues a sync), ready, and error (contained to that widget).
- Pin and dismiss go through the `updateWidgetPref` Server Action (optimistic, then `refresh()`), or `POST /api/widget-prefs` for non-React callers.

## Platform pages and the Profile API (Phase 4 bridge)

- `/connections`: the source cards from onboarding Step 5 (`ConnectorCards`), for users who have finished onboarding. Connector actions live in `src/app/(dashboard)/connections/actions.ts` and are shared with Step 5. Their guard (`requireConnectorUser`) and the GitHub OAuth routes (`allowDone`) admit any user who has reached the connectors step. OAuth returns to wherever it started (`?from=connections`). Disconnecting after onboarding queues a recompute.
- `/profile`: the user's usable facts, repos and unified projects grouped by section, each with its source badge and a confirmed / edited / from-source marker (`src/lib/profile/unified.ts` → `loadProfile`).
- `GET /api/profile/v1/me`: the module-facing contract (`toProfileV1`, from the same loader), authenticated by the Auth.js session cookie. It sends an ETag (`If-None-Match` → 304), `Cache-Control: private, no-cache`, 401 JSON without a session, and 503 JSON if the data can't load. Email and phone are never included. Spec: [`/api/profile/openapi.json`](public/api/profile/openapi.json) (OpenAPI 3.1, static).
- Unknown single-segment paths return a real 404: `src/app/(dashboard)/[module]/page.tsx` resolves the slug before any Suspense boundary (`instant = false`).

## Phase 4: modules, feature flags, pilot-site embed

**Feature flags** (`feature_flags` table, read on every request, all seeded **off**): `avasar_profile_api`, `collaborate_profile_api`, `learn_profile_api`, `meet_profile_api`, `iris_profile_api`, `pilot_site_embed`.

```bash
npm run flags                         # list
npm run flags -- on avasar_profile_api
npm run flags -- off pilot_site_embed
```

**Modules** call `GET /api/profile/v1/me` with the session cookie and `X-AIT-Module: <avasar|collaborate|learn|meet|iris>` (or `?module=`). Responses: 401 without a session, 400 without a known module, 403 when that module's flag is off.

**Pilot-site embed:**

```html
<div id="ait-widget"></div>
<script src="https://www.aitathastu.com/embed.js" async></script>
```

1. Add the site's exact origin to `EMBED_ALLOWED_ORIGINS` (Vercel env), and turn on `pilot_site_embed`.
2. The visitor clicks "Show my AI Tathastu profile". A popup (`/embed/authorize`) asks them to approve, then `postMessage`s a 15-minute, read-only token to that origin only. No third-party cookies are involved.
3. The widget calls `/api/profile/v1/me` with `Authorization: Bearer …` and renders, in Shadow DOM, the compact `EmbedV1` view: name, role, interview readiness and top 3 skills, plus a dashboard link. It shows no contact details or history.

Tokens are signed with `EMBED_JWT_SECRET` (never `AUTH_SECRET`), bound to the minting origin, and can't mint further tokens.

**Security tests:** `npm test` (Vitest, real route handlers on PGlite with all migrations). They cover IDOR between users, forged, unsigned, expired and wrong-origin tokens, 401, 400 and 403, and CORS.

## Tests

- `npm test`: Vitest unit and security tests (PGlite in memory).
- `npm run test:e2e`: Playwright, the whole Phase 1–3 journey in Chrome (`e2e/core-flow.spec.ts`). It starts a throwaway stack (`e2e/support/stack.mts`: in-memory Postgres with every migration, served over TCP, plus a fake R2), builds the app and runs it against that stack with the env in `e2e/support/env.ts`, which blanks every real service. Sign-in uses a minted Auth.js session cookie, and the test stands in for the worker by writing its outputs (resume facts, then the `e2e/fixtures/profile-view.json` view). First run elsewhere: `npx playwright install chromium` (locally it uses installed Chrome; set `CI=1` to use Playwright's Chromium).
- `npm run verify:phase2 -- <user-id | email>`: read-only check that compute_intelligence produced its output for a user: a `profile_views` row with at least 3 widgets, skills (via `skill_evidence`) and `eris_scores` rows. Uses `DATABASE_URL` (env, else `.env.local`). Exits 1 if any check fails.

A `DATABASE_URL` on localhost makes the app use node-postgres instead of Neon (`src/db/local.ts`); `R2_ENDPOINT` points uploads at any S3-compatible endpoint.
