# AI Tathastu — Ultra-Detailed 4-Phase Implementation Plan

Oct 21, 2026

## What this plan covers

Four sequential phases, each with its own acceptance gate. No phase starts until the previous one's gate is met, but work within a phase can proceed in parallel tracks.

| Phase | Name | Scope | Gate |
| --- | --- | --- | --- |
| 1 | Onboarding + Full Data Collection | Account creation, 6-step onboarding wizard, resume extraction pipeline, all digital-footprint connectors (GitHub, LinkedIn, Kaggle, Stack Exchange, LeetCode/HackerRank via Apify, portfolio via Firecrawl), user review screen | A real user completes onboarding end-to-end, confirms extracted facts, and sees a populated profile with evidence |
| 2 | Intelligence Layer | Skill graph computation, unified project matching across sources, P(w) dashboard widget scoring, conflict resolution, ERIS readiness scoring, recompute triggers | Changing a user's career role re-scores and re-orders the widget list within 30 s |
| 3 | Dashboard | Widget registry, composition engine, all 4 dashboard variants (placement, learning, collaboration, research), empty/stale/error states, user personalization controls | 5 test users across different goals each see a meaningfully different, actionable dashboard |
| 4 | Pilot integration | Reverse-proxy shell, `/api/profile/v1` OpenAPI contract, Avasar/Collaborate/Learn/Meet/Iris connections, feature flags, shared auth, pilot-site widget embed | Each existing module reads live profile data without regression to its existing functionality |

**Stack:** Next.js on Vercel Hobby → Pro at launch, NeonDB free → paid, Render worker (GitHub Actions during free phase), Cloudflare R2, provider router with 5 Groq + 4 Gemini + 4 OpenRouter + 5 Firecrawl + 4 Apify + 3 Kaggle + 1 Stack Exchange keys, Tailwind + shadcn/ui, Auth.js, Resend, Upstash, Sentry.

## Phase 1 — Onboarding + Full Data Collection

### 1.1 Account creation and auth

Implement with Auth.js. Providers: Google OAuth, LinkedIn OIDC (name + email + photo only), email magic link. Session in httpOnly cookie. On first sign-in, create one row each in `users`, `onboarding_state` (current\_step = 'career\_direction'), and `consents` (all purposes unset). Never redirect to the dashboard until at least Step 1 of onboarding is saved — redirect to `/onboarding/career-direction` instead.

### 1.2 Onboarding wizard — 6 steps

Each step writes immediately on change (not only on "Next") to `onboarding_state`. The wizard is resumable: on any load of `/onboarding/*`, read `current_step` and redirect to the correct sub-route.

**Step 1 — Career direction.** Display all 13 role cards from the requirements screenshot (Generative AI Engineer, ML Engineer, AI Engineer, AI Researcher, Data Scientist, Deep Learning Engineer, MLOps Engineer, NLP Engineer, Computer Vision Engineer, Robotics & AI Engineer, RL Engineer, AI Product Builder/Founder, Still Exploring). Searchable. Multiple selection allowed but prompt user to limit to their primary direction. On select, write `career_role` and `career_role_other` to `onboarding_state`.

**Step 2 — Priorities.** Show all 6 priority cards: Learn AI & ML, Internships & Jobs (Avasar), People & Mentors (Collaborate), Collaborate, Build Projects, Research & Events. User picks up to 3 and ranks them by drag-and-drop or numbered buttons. Write ordered array to `priorities`. This ranking directly feeds the intelligence layer's `αI` term.

**Step 3 — Basic profile.** Full name (pre-filled from OAuth if available), university, degree, specialization, academic year, city/country. Write to `users` and create or update the `identity` field\_group rows in `profile_facts` with `origin = user_entered`, `confirmation = confirmed`.

**Step 4 — Resume import.** Drag-drop or file picker. Accepted: PDF, DOCX, JPG, PNG, WebP, TXT. Max 10 MB. Upload goes directly to Cloudflare R2 via a Vercel-issued signed URL (the file never passes through a Vercel function body). On upload complete, Vercel writes a row to `files` and inserts a `resume_extract` job in `jobs`. Show the user the async progress screen: stage name, queue estimate, "we'll email you when it's done." Poll `/api/jobs/:id` with exponential backoff (2 s → 4 → 8 → 10 s max), ETag-gated so unchanged responses return 304. Worker sends a Resend email on completion or failure.

**Step 5 — Connect external sources.** One card per source: GitHub (OAuth), LinkedIn (OIDC already done at login; separately offer data-zip upload or DMA for EU users), Kaggle (API key paste), Stack Exchange (OAuth or API key), LeetCode/HackerRank (public profile URL — Apify scrape), personal portfolio (URL — Firecrawl), ORCID (OAuth). Each card has its own Connect / Retry / Disconnect state, independent of the others. Connecting enqueues a `connector_sync` job. User can skip all and continue. Write `connectors_status` map to `onboarding_state`.

**Step 6 — Review and consent.** Show profile completeness bar, connected sources, any extraction jobs still running. Consent checkboxes for `external_ai` (required for Groq/Gemini LLM extraction), `linkedin_scrape` (required for Apify/Firecrawl on LinkedIn), `analytics`. All in plain language with policy version recorded. Write to `consents` (append-only). Button: "Generate my profile" → set `current_step = done`, enqueue `compute_intelligence` job, redirect to dashboard.

### 1.3 Resume extraction pipeline (Render worker)

**Stage 1 — Intake.** Check file size (≤10 MB), MIME type and magic bytes. ClamAV malware scan. Hash the file (SHA-256). If the same hash + pipeline version exists in `files`, return the cached result immediately. Classify: text PDF, scanned PDF, DOCX, image (JPG/PNG/WebP), TXT.

**Stage 2 — Text and layout extraction.**

- Text PDF: PyMuPDF or pdfplumber. Preserve reading order, rebuild columns and tables. Record page numbers and bounding boxes for every text block.
- DOCX: python-docx. Extract paragraphs, tables, headings and styles.
- Scanned PDF / image: Tesseract with per-page confidence. Pages below 0.70 confidence are flagged `ocr_uncertain`. If the user has `external_ai` consent, send uncertain pages to Gemini (multimodal) via the key pool.

**Stage 3 — Deterministic parsing.** Run regex and lexicon rules for: email, phone (libphonenumber), URLs, dates (dateutil), degree names (lexicon of \~2,000 degree strings), institution names (lexicon), section-header detection, known skill keywords (ESCO taxonomy + custom list), programming languages, frameworks. Each match writes a candidate row with `extraction_method = deterministic`, `confidence = 0.95`, `source_evidence` = the exact matched substring, `location` = page + bbox.

**Stage 4 — LLM recovery (only for missing or low-confidence fields).** For each of the 10 field groups that has fewer confirmed deterministic fields than the group minimum, send only the relevant text section (not the full resume) to the provider chain:

1. Groq pool (primary — 3 prod keys). Model: llama-3.1-70b or equivalent fast model. Temperature 0. Output: strict JSON schema. Every field must include `evidence_span` (verbatim quote from the resume text, max 200 chars).
2. Gemini pool (2 prod keys) if Groq exhausted or returns `needs_review`.
3. OpenRouter pool (2 prod keys) as final fallback.
4. If all fail: mark job `needs_review`, notify user via email.

**Stage 5 — Evidence verification (code, not LLM).** For every LLM-extracted field: fuzzy-match the `evidence_span` against the source text (threshold 0.90, whitespace-normalized). Reject if not found. Validate by type: parse dates, validate emails, validate phones, check degree against lexicon. Disagreements between deterministic and LLM candidates produce a `fact_conflicts` row; neither silently wins.

**Stage 6 — Persist to `profile_facts`.** Write one row per field with full envelope: `extracted_value`, `normalized_value`, `source_evidence`, `location` (page + bbox), `extraction_method`, `origin = resume`, `confidence`, `validation_status`, `confirmation = unconfirmed`. Write stage diagnostics to `job_diagnostics` for every field that remains empty, recording which stage lost it.

**Stage 7 — User review screen.** This is the accuracy lever. The frontend reads all `profile_facts` where `confirmation = unconfirmed` and `origin = resume`, grouped by `field_group`, sorted by `confidence` ascending (low-confidence first). Each field shows: editable input, save checkbox, source evidence with page number, confidence label (High ≥85%, Medium ≥60%, Low <60%), validation status, Reject button, Add another button for repeatable groups. User can bulk-confirm high-confidence fields with one click. On save: `confirmation = confirmed` for approved rows, `confirmation = rejected` for rejected rows, `confirmation = confirmed` + `origin = user_entered` for user-typed new fields. Only confirmed rows are used by the intelligence layer.

### 1.4 Connector pipelines (each runs as a Render worker job)

**GitHub.** OAuth. Calls GitHub REST API: `/user`, `/user/repos`, per-repo languages, README, topics, contributors, commits (last 90 days), pull requests. Saves raw JSON to `raw_snapshots`. Normalize: one `profile_facts` row per repo field (name, description, language, stars), one `code_repositories` row per repo, one `skill_evidence` row per detected language/framework. `origin = github`, `extraction_method = api:github`.

**Kaggle.** API key (pool of 3). Calls Kaggle API: `/users/{username}`, `/competitions/list?user={username}`, `/datasets/list?user={username}`, `/kernels/list?user={username}`. Normalize competitions into `achievements`, notebooks into `projects`, skills into `skill_evidence`.

**Stack Exchange.** Single app key. Calls SE API v2.3: `/users/{id}` (by URL lookup), `/users/{id}/answers`, `/users/{id}/tags`. Normalize top tags into `skill_evidence` with `extraction_method = api:stack_exchange`, reputation as `achievement`.

**LeetCode/HackerRank/HackerEarth (public profile scraping).** Apify pool (4 keys). Select an actor per platform that requires no login cookies. Worker validates URL pattern, enqueues Apify run, polls `/runs/{runId}` until status = `SUCCEEDED`, fetches dataset. Quality gate: reject if name field is missing or login-wall text is present. Normalize problems solved, ratings, badges into `profile_facts` and `skill_evidence`. Raw output deleted after 30 days.

**Portfolio / personal site.** Firecrawl pool (5 keys). POST to Firecrawl `/scrape` with the user-provided URL. Returns clean markdown. Run the same LLM extraction chain (Stage 4 above) on the markdown to extract project names, descriptions, technologies, links. Evidence span verified against the markdown. `origin = portfolio`, `extraction_method = firecrawl + llm:groq`.

**LinkedIn.** Three tiers:

- Tier 1 (all users): OIDC name + email already captured at login. `origin = linkedin_oidc`.
- Tier 2 (EU/EEA/Switzerland only): DMA Snapshot API. Worker polls until snapshot ready (up to 30 min). Parses JSON for positions, education, skills. `origin = linkedin_dma`.
- Tier 3 (all users): User uploads "Download your data" zip or LinkedIn PDF. Worker unzips/parses CSV files or runs resume pipeline on the PDF. `origin = linkedin_export`.
- Tier 4 (flag-gated, consent required): Apify actor on user's own `linkedin.com/in/` URL, no cookies. Quality gate. `origin = linkedin_scrape`. Circuit breaker auto-disables if >30% of scrapes fail in 1 hour.

**All connectors share:** raw snapshot written first, normalize as a separate retryable step, idempotency key prevents double-writes, `connections` table tracks last sync + stale flag, "Disconnect and delete" removes the snapshot and all facts from that origin.

## Phase 2 — Intelligence Layer

The intelligence layer is a Render worker job (`compute_intelligence`) that runs on three triggers: a fact's `confirmation` changes, `career_role` or `priorities` change in `onboarding_state`, or a connector sync finishes. It reads confirmed facts and writes one updated row to `profile_views(user_id, view jsonb)`. The dashboard never computes anything itself — it reads this pre-computed row.

### 2.1 Unified project matching

The same project may appear in a CV, GitHub, LinkedIn, Kaggle, portfolio, and a hackathon submission. The job resolves them into one canonical project record.

Algorithm:

1. Collect all `projects` field\_group rows and all rows in `code_repositories` across all origins for this user.
2. Build a candidate set of (record\_a, record\_b) pairs where two or more of these match: project name token overlap ≥60%, repository URL match, shared technologies ≥2, overlapping date range within 6 months, or explicit URL link from one to another.
3. For each candidate pair above the threshold, create or update a `unified_projects` row linking the source `profile_fact` ids. Assign a `canonical_title` (prefer GitHub repo name if present, else CV project name, else LinkedIn project name).
4. Mark unmatched records as standalone projects.
5. Conflicting values (e.g. CV says "2023" and GitHub commit history starts 2024) write a `fact_conflicts` row; the user resolves it on the conflict screen.

### 2.2 Skill graph computation

For each confirmed or api-sourced skill fact:

1. Normalize the skill name via the `skill_aliases` table ("Py" → "Python", "pytorch" → "PyTorch").
2. Map to a canonical `skills` row. Insert if new.
3. Write one `skill_evidence` row linking `user_id`, `skill_id`, `fact_id`, `source`, `evidence_strength`. Evidence strength formula: confirmed resume = 0.5, GitHub language usage = 0.7 (scaled by commit count), assessment result = 0.9, mentor evaluation = 1.0, self-reported only = 0.3.
4. Walk the skill relationship graph: for each confirmed skill, mark prerequisite skills as `inferred` (not `confirmed`) if they have no direct evidence — stored separately and labeled in the UI as "likely has" not "has."
5. Compute per-skill readiness: `sum(evidence_strength) / max_possible_for_role`, capped at 1.0. Store in `skill_readiness`.

### 2.3 Dashboard widget scoring (P(w) = αI + βG + γR + δF)

Weights default to α=0.35, β=0.30, γ=0.25, δ=0.10 (stored in `intelligence_config`, changeable without a deploy).

For each widget definition in the registry:

- **I (intent relevance):** does the widget's declared `requiredIntent` include the user's primary priority? 1.0 = exact match, 0.5 = secondary match, 0.0 = not in any priority.
- **G (goal match):** score the overlap between the widget's domain and `career_role`. A job-matching widget scores 1.0 for "ML Engineer" but 0.2 for "Still Exploring." Defined as a lookup table per widget per role, stored in `widget_role_affinity`.
- **R (readiness):** does the user have enough confirmed data for this widget to be actionable? Each widget declares its `requiredData` (list of field\_groups). Compute fraction of required groups that have ≥1 confirmed fact. A widget with 0 required data always scores R=1.0.
- **F (freshness):** if the widget depends on a connector, compute `1 - (hours_since_sync / stale_threshold_hours)`, floored at 0. No connector dependency = F=1.0.

Final pass: apply `widget_prefs` dismissals (score → 0), user-pinned widgets (score → 1.1), then sort descending. Write ordered widget list with per-widget data into `profile_views.view`.

### 2.4 ERIS readiness scoring

ERIS (Interview Readiness Score) is computed per target role, not globally. For each role in `career_role`:

1. Load the role's `required_skills` from `role_skill_matrix`.
2. For each required skill, look up the user's `skill_readiness` score.
3. Weighted average: technical skills 50%, problem-solving evidence (LeetCode/HackerRank data) 25%, project demonstration 25%.
4. Write to `eris_scores(user_id, role, score, breakdown_json, computed_at)`.
5. Surface top-3 gaps (lowest `skill_readiness` among high-weight required skills) as actionable next steps in the dashboard.

### 2.5 Conflict resolution

All `fact_conflicts` rows are surfaced to the user on a dedicated screen. Each row shows: field name, value A + source + date, value B + source + date, a Pick A / Pick B / Type my own control. Resolution writes `confirmation = confirmed` to the winning fact and `confirmation = rejected` to the loser, then triggers a partial recompute for that field group only.

## Phase 3 — Dashboard

### 3.1 Widget registry

Every widget is declared once in a TypeScript registry file. The intelligence layer reads this file; the frontend renders from it. No widget data or eligibility logic lives in the UI components.

```ts
const widgets: WidgetDefinition[] = [
  {
    id: 'eris_readiness',
    module: 'eris',
    label: 'Interview Readiness',
    requiredIntent: ['avasar_jobs'],
    requiredData: ['skills', 'experience'],
    eligibility: p => p.erisScore !== null,
    primaryAction: { label: 'Start mock interview', href: '/eris' },
    freshnessField: null,
  },
  {
    id: 'job_matches',
    module: 'avasar',
    label: 'Jobs that fit you',
    requiredIntent: ['avasar_jobs'],
    requiredData: ['skills', 'experience', 'education'],
    eligibility: p => p.confirmedSkills.length >= 3,
    primaryAction: { label: 'View matches', href: '/avasar' },
    freshnessField: null,
  },
  {
    id: 'skill_gaps',
    module: 'learn',
    label: 'Skills to develop',
    requiredIntent: ['learn_ai_ml', 'avasar_jobs'],
    requiredData: ['skills'],
    eligibility: p => p.skillGaps.length > 0,
    primaryAction: { label: 'Start learning', href: '/learn' },
    freshnessField: null,
  },
  {
    id: 'github_activity',
    module: 'profile',
    label: 'Recent GitHub work',
    requiredIntent: ['build_projects', 'avasar_jobs'],
    requiredData: [],
    eligibility: p => p.githubConnected,
    primaryAction: { label: 'View projects', href: '/projects' },
    freshnessField: 'github',
  },
  // ... collaboration_opportunities, mentor_sessions, research_feed, meet_upcoming
];
```

### 3.2 Four dashboard variants

These are not separate layouts — they are the same renderer with different `profile_views` input, which naturally surfaces different widgets at the top.

**Placement/career variant** (primary priority: Avasar jobs): ERIS readiness score with weak-area callout, job matches from Avasar, skills-to-develop from Learn, resume completeness indicator, next application deadline from Meet.

**Learning variant** (primary priority: Learn AI & ML): Skill graph showing current vs. target, next learning step with time estimate, recommended project to build (linked to GitHub and Learn), ERIS skill test for next topic, Kaggle competition matching current skills.

**Collaboration variant** (primary priority: Collaborate): Open project opportunities matching skills + availability, people to connect with (complementary skills, similar domains), active team roles, upcoming team meetings from Meet.

**Research variant** (primary priority: Research & Events): Recent publications and citation stats (ORCID/Scholar), research connections, active research projects, relevant competitions and conferences, skill gaps for target research direction.

### 3.3 All widget states, required before any widget ships

Every widget must implement all six states:

| State | Trigger | What to show |
| --- | --- | --- |
| loading | `profile_views` not yet computed | Skeleton with "Personalizing your dashboard..." |
| empty | eligibility passes but no data yet | Message + specific CTA to get data (e.g. "Connect GitHub to see your projects") |
| partial | some but not all required data present | Show what's available + a prompt for the missing piece |
| stale | connector last synced > stale\_threshold | Yellow indicator + "Synced X days ago · Refresh" |
| error | module returned 5xx or connection failed | "Avasar is temporarily unavailable" — never crash the whole dashboard |
| ready | normal | Full widget content |

The dashboard shell catches per-widget errors in an error boundary. One failing widget never crashes others.

### 3.4 User personalization controls

Persistent controls (stored in `widget_prefs`):

- **Dismiss:** hides a widget until the user re-enables it in Settings.
- **Pin:** forces a widget to the top regardless of P(w) score (sets score to 1.1 in Phase 2).
- **Reorder:** drag-and-drop; stored as an explicit override array in `widget_prefs`. Overrides are applied as a final pass after scoring.
- **Change goal:** a persistent top-bar control. Changing `career_role` or `priorities` enqueues `compute_intelligence` immediately and shows a "Updating your dashboard..." spinner while the job runs (typically under 5 s at 5k-user scale).

### 3.5 Navigation and Eiora/EORA

The persistent navigation bar (Profile, Projects, Skills, ERIS, Learn, Collaborate, Connections, Mentor, Meet, CV Builder) and the Eiora/EORA assistant panel are rendered by the shell on every route, outside the dashboard widget container. They are never hidden by personalization, never depend on `profile_views`, and never fail when a widget fails.

## Phase 4 — Pilot Website Integration

### 4.1 Profile API contract

All existing modules (Avasar, Collaborate, Learn, Meet, Iris) and the pilot website consume a single read-only API. No module talks to `profile_facts` directly.

```
GET /api/profile/v1/me
Authorization: Bearer <session JWT>

Response:
{
  "identity": { "name", "headline", "university", "degree", "career_role" },
  "skills": [ { "name", "category", "evidenceStrength", "verificationStatus" } ],
  "projects": [ { "canonicalTitle", "technologies", "links", "contributions" } ],
  "experience": [ { "org", "role", "dateRange", "responsibilities" } ],
  "education": [ { "institution", "degree", "dates", "grade" } ],
  "erisScore": { "overall", "byRole", "gaps" },
  "readinessIndicators": { "profileComplete", "resumeLinked", "connectorsCount" },
  "goals": { "primaryRole", "priorities" }
}
```

Versioned at `/v1`: breaking changes get `/v2` with a deprecation notice. Every module pins its version. The schema is published as an OpenAPI 3.1 spec at `/api/profile/openapi.json`.

### 4.2 Integration method by module type

**If modules are separate deployed apps on separate domains** (most likely):

- Add Vercel rewrite rules so `aitathastu.com/avasar/*` proxies to `avasar.yourhost.com/*`, preserving path and headers. Auth cookie is set on the root `aitathastu.com` domain so it's shared across all sub-paths.
- Each module adds one call to `/api/profile/v1/me` on page load, using the existing session cookie. The response is stored in that module's own state; it is not re-fetched on every component render.
- No module-side database query touches AI Tathastu's `profile_facts` or `profile_views` tables.

**If modules are routes in one Next.js app:**

- They already share the session. Add a shared `useProfile()` React context that fetches `/api/profile/v1/me` once per session.
- Each module page imports `useProfile()` instead of making its own data fetch.

**Pilot website embed (for the existing website that predates the platform):**

1. The user authenticates on aitathastu.com. A short-lived (15 min), read-only scoped JWT is issued.
2. The pilot website adds one script tag: `<script src="https://aitathastu.com/embed.js"></script>`.
3. The embed script renders a compact profile widget (readiness score, top skills, next recommended action) in a designated `<div id="ait-widget">`. It calls the profile API with the scoped token.
4. Clicking the widget deep-links the user to the full dashboard.
5. The embed respects `visibility` settings on the profile — private fields are never sent to the embed endpoint.

### 4.3 Shared authentication

All modules share the Auth.js session stored in an httpOnly cookie on `.aitathastu.com`. There is no SSO redirect for modules under the same domain. For external pilot sites on a different domain, issue the scoped JWT described above (read-only, 15-min expiry, signed with a separate key from session tokens, not re-issuable client-side).

### 4.4 Feature flags per module integration

The `feature_flags` table gates each integration independently:

| Flag key | Controls |
| --- | --- |
| `avasar_profile_api` | Avasar reads from `/api/profile/v1/me` |
| `collaborate_profile_api` | Collaborate reads from the profile API |
| `learn_profile_api` | Learn reads skill gaps and goals from the profile |
| `meet_profile_api` | Meet reads identity and availability from the profile |
| `iris_profile_api` | Iris reads profile context |
| `pilot_site_embed` | Embed script is served and active |
| `linkedin_scrape` | LinkedIn Apify/Firecrawl connector active |
| `external_ai` | Overrides all LLM extraction globally |

Flags are read on every request; toggling one requires no deploy. The admin screen shows each flag's current state, who last changed it, and when.

### 4.5 Module integration acceptance tests

For each module, an automated CI test checks:

1. The module's existing routes return HTTP 200 with the flag OFF (no regression).
2. The module's existing routes return HTTP 200 with the flag ON (no regression with the profile API active).
3. A test user's skills appear correctly in the module's UI when the flag is ON.
4. A `profile_facts` write does NOT bypass the API (no direct DB access from module code).
5. The module handles the profile API returning 503 gracefully (shows its own error state, does not crash).

## Complete database schema

All tables in one Neon Postgres database. Migrations in plain SQL (dbmate or Atlas), applied to a Neon branch first.

```sql
-- IDENTITY AND AUTH
users(id uuid pk, email citext unique, name text, avatar_url, created_at, deleted_at)
consents(id, user_id, purpose text, -- 'external_ai' | 'linkedin_scrape' | 'analytics'
  granted bool, policy_version, created_at)  -- append-only

-- ONBOARDING
onboarding_state(user_id uuid pk, current_step text, career_role text,
  career_role_other text, priorities jsonb, resume_uploaded bool default false,
  connectors_status jsonb, consents_completed bool default false,
  completed_at timestamptz, updated_at timestamptz)

-- FILES
files(id uuid pk, user_id, kind text, -- 'resume' | 'linkedin_zip' | 'portfolio_screenshot'
  storage_key text, sha256 text, size_bytes int, mime text,
  scan_status text, -- 'pending' | 'clean' | 'infected'
  delete_after timestamptz, created_at)

-- EVIDENCE LAYER
raw_snapshots(id uuid pk, user_id, source_id text, file_id,
  payload_enc bytea, payload_hash text, created_at, delete_after)

profile_facts(id uuid pk, user_id, field_group text, field_name text,
  record_key text, -- groups one education/experience/project entry
  extracted_value jsonb, normalized_value jsonb,
  source_evidence text, location jsonb, -- {page, bbox}
  extraction_method text, -- 'deterministic'|'ocr'|'llm:groq'|'api:github'|...
  origin text, -- 'resume'|'github'|'kaggle'|'linkedin_dma'|'user_entered'|...
  confidence real, validation_status text, -- 'validated'|'unresolved'|'conflicting'
  confirmation text, -- 'unconfirmed'|'confirmed'|'edited'|'rejected'
  snapshot_id, superseded_by uuid, created_at)

fact_conflicts(id uuid pk, user_id, field_name, record_key,
  fact_a uuid, fact_b uuid, resolution text,
  resolved_by text, resolved_at timestamptz)

-- CONNECTOR STATE
connections(id uuid pk, user_id, source_id text,
  access_method text, -- 'oauth'|'api_key'|'public_scrape'|'user_import'
  token_enc bytea, status text, -- 'connected'|'syncing'|'stale'|'failed'|'reauth_needed'
  last_sync_at timestamptz, stale_after timestamptz)

-- JOB QUEUE
jobs(id uuid pk, type text, user_id, idempotency_key text unique,
  status text, -- 'queued'|'running'|'done'|'failed'|'needs_review'
  payload jsonb, attempts int default 0, max_attempts int default 3,
  run_at timestamptz, locked_by text, locked_until timestamptz,
  last_error text, created_at, finished_at)

job_diagnostics(id uuid pk, job_id, stage text, field_group text, field_name,
  action text, reason text, created_at)

provider_calls(id uuid pk, job_id, provider text, key_label text,
  model text, tokens_in int, tokens_out int, cost_usd real,
  latency_ms int, status int, created_at)

-- SKILL GRAPH
skills(id uuid pk, canonical_name text unique, category text)
skill_aliases(alias text pk, skill_id uuid)
skill_evidence(user_id, skill_id, fact_id, source text,
  evidence_strength real, created_at)
skill_readiness(user_id, skill_id, role text, score real,
  computed_at timestamptz, primary key (user_id, skill_id, role))

-- UNIFIED PROJECTS
unified_projects(id uuid pk, user_id, canonical_title text,
  source_fact_ids uuid[], match_confidence real,
  technologies text[], status text, timeline_start date, timeline_end date,
  conflict_present bool, created_at, updated_at)

code_repositories(id uuid pk, user_id, source text, repo_name text,
  description text, url text, languages jsonb, topics text[],
  stars int, forks int, last_commit_at timestamptz, created_at)

-- ERIS AND ASSESSMENT
eris_scores(user_id, role text, score real, breakdown_json jsonb,
  computed_at timestamptz, primary key (user_id, role))

role_skill_matrix(role text, skill_id uuid, weight real,
  primary key (role, skill_id))

-- INTELLIGENCE ENGINE
profile_views(user_id uuid pk, view jsonb, updated_at timestamptz)
intelligence_config(key text pk, value jsonb, updated_by text, updated_at)
widget_role_affinity(widget_id text, role text, affinity real,
  primary key (widget_id, role))
widget_prefs(user_id, widget_id text, dismissed bool default false,
  pinned bool default false, order_override int,
  primary key (user_id, widget_id))

-- PLATFORM CONTROLS
feature_flags(key text pk, enabled bool, updated_by text, updated_at)
audit_log(id uuid pk, actor text, action text, subject text, at timestamptz)
```

Key indexes: `profile_facts(user_id, field_group, field_name) WHERE superseded_by IS NULL` for dashboard reads; `profile_facts(user_id) WHERE validation_status = 'conflicting'` for the conflict screen; `jobs(run_at) WHERE status = 'queued'` (partial) for worker polling; `files(user_id, sha256) UNIQUE` for the duplicate-upload cache.

## API key allocation and provider router

### Key allocation

| Provider | Total keys | Prod pool | Dev | Eval/test | Spare |
| --- | --- | --- | --- | --- | --- |
| Groq | 5 | 3 | 1 | 1 | — |
| Gemini | 4 | 2 | 1 | — | 1 |
| OpenRouter | 4 | 2 | 1 | — | 1 |
| Firecrawl | 5 | 3 | 1 | — | 1 |
| Apify | 4 | 2 | 1 | — | 1 |
| Kaggle | 3 | 1 | 1 | — | 1 |
| Stack Exchange | 1 | 1 | — | — | — |

All keys live only in worker environment variables. Never in Vercel public env, never in the repo. Each key is labeled in `provider_calls` (e.g. `groq_prod_2`) but never logged as its actual value.

### Provider router (runs on Render worker only)

The router is a single Python module `provider_router.py` that every LLM and scraping call must go through. Direct imports of provider clients outside this module are a lint error.

```python
def route_llm(prompt, schema, consent_granted, purpose):
    """Returns structured JSON output or raises NeedsReviewError."""
    if not consent_granted:
        raise ConsentRequired(purpose)
    chain = [
        GroqPool(models=['llama-3.1-70b-versatile', 'mixtral-8x7b']),
        GeminiPool(models=['gemini-1.5-flash']),   # scans only unless Groq exhausted
        OpenRouterPool(models=['meta-llama/llama-3-70b-instruct']),
    ]
    for provider in chain:
        key = provider.pool.acquire()
        if key is None:
            continue  # all keys in cooldown, try next provider
        try:
            result = provider.call(key, prompt, schema, timeout=20)
            log_call(provider, key, result)
            if verify_evidence(result, source_text):
                return result
        except RateLimitError as e:
            provider.pool.report(key, 429, e.retry_after)
        except (AuthError, KeyError):
            provider.pool.report(key, 401)
        except TimeoutError:
            provider.pool.report(key, 500)
    raise NeedsReviewError("All providers exhausted")

def route_scrape(url, provider_preference):
    """Returns clean text/markdown or raises ScrapeFailed."""
    # Firecrawl pool first, Apify pool second
    ...
```

Circuit breaker per provider: if >20% of calls in the last 10 min fail, pause that provider for 5 min. LinkedIn-specific circuit breaker: if >30% of scrapes fail in 1 hour, disable `linkedin_scrape` feature flag automatically and alert via Sentry.

## Week-by-week build sequence

Assumes 2–3 engineers. Gates are hard — the next phase does not start until the gate is met.

| Week | Track | Deliverable | Gate |
| --- | --- | --- | --- |
| 1–2 | Infra | Repos, three environments (dev/staging/prod), Neon branches, Vercel + R2 + GitHub Actions wired, Auth.js with Google + LinkedIn OIDC + magic link, migrations for all Phase 1 tables, Sentry and Upstash connected | "Hello world" auth flow works in all three environments |
| 3–4 | Phase 1 | Onboarding Step 1 (career direction) + Step 2 (priorities) + Step 3 (basic profile), all writing to `onboarding_state`; resumable on refresh | Steps 1–3 persist across browser close and re-login |
| 5–6 | Phase 1 | Resume upload to R2, resume extraction worker (Stages 1–4), user review screen (all 10 sections), `profile_facts` writes | A real PDF is uploaded, extracted, reviewed and confirmed end-to-end by a real user |
| 7 | Phase 1 | GitHub connector (OAuth + API), Kaggle connector, Stack Exchange connector, `connections` table, stale-flag cron | All three connectors sync real data and write to `profile_facts` |
| 8 | Phase 1 | LeetCode/HackerRank via Apify, portfolio via Firecrawl, LinkedIn tiers 1–3 | Onboarding Steps 5–6 complete; all connectors available; consent flow tested |
| 9–10 | Phase 2 | Unified project matching algorithm, skill graph computation, `unified_projects` + `skill_evidence` + `skill_readiness` tables populated | Changing career role produces visibly different skill gap list within 30 s |
| 11 | Phase 2 | P(w) scoring engine, `profile_views` writes, `widget_prefs`, `intelligence_config`, ERIS scoring | `profile_views` row is correct for 5 test users across different goals |
| 12 | Phase 3 | Widget registry with all widgets declared, dashboard renderer, Tailwind + shadcn/ui component library, all 6 widget states implemented | All 4 dashboard variants render correctly in tests; no widget crashes another |
| 13 | Phase 3 | User personalization controls (dismiss, pin, reorder), change-goal flow, conflict resolution screen, ERIS module page, skill graph visualization | 5 pilot users complete dashboard usability round; median confirm-to-working-dashboard under 5 min |
| 14–15 | Phase 4 | `/api/profile/v1/me` OpenAPI spec published, feature flags wired, first module (Avasar or Learn) integrated and tested | Module reads profile data with flag ON; existing functionality unchanged with flag OFF |
| 16 | Phase 4 | Remaining modules integrated (Collaborate, Meet, Iris), pilot site embed script, admin panel for feature flags and provider health, load test (50 users), IDOR tests in CI | All 5 modules pass integration acceptance tests; no regressions |

### Acceptance gates per phase

**Phase 1 gate:** A new user registers, completes all 6 onboarding steps, uploads a real resume, connects at least 2 external sources, reviews the extraction, confirms their facts, and ends with a populated profile showing evidence sources. Zero invented fields in the saved profile.

**Phase 2 gate:** Changing the user's `career_role` from one role to another produces a visibly different skill gap list, updated ERIS score, and re-ordered widget list within 30 seconds. Verified on 5 different role combinations.

**Phase 3 gate:** 5 pilot users with different goals (placement, learning, collaboration, research, exploring) each see a meaningfully different dashboard. All widget states (including error and stale) are demonstrated. No dashboard crash observed in 2 hours of use.

**Phase 4 gate:** Every existing module (Avasar, Collaborate, Learn, Meet, Iris) passes its integration acceptance tests (Section 4.5) with flag ON and flag OFF. The pilot website embed renders the widget correctly. No user can read another user's profile data (IDOR test green in CI).
