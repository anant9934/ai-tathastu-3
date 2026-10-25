# Worker

Python job runner for `jobs` rows. It runs on Render, never on Vercel.

**Deployment shape (Render free tier):** a Web Service, since the free tier has no Background Workers. `server.py` serves `GET /health` on `$PORT` and runs the queue loop in a background thread; `/health` returns 503 if that thread dies, so Render restarts the instance. Free instances sleep after about 15 minutes without HTTP traffic, so the web app pings `WORKER_WAKE_URL` after queuing a job (`src/lib/worker-ping.ts`). Jobs queued while it sleeps wait safely in Postgres; the first one after a sleep pays a cold start of up to about a minute. `python worker.py` runs the loop without HTTP, for local development or a paid Background Worker.

| Job type | Handler | Does |
| --- | --- | --- |
| `resume_extract` | `resume/extract.py` | Stages 1–6: intake → text/OCR → deterministic → LLM recovery → evidence verification → `profile_facts` |
| `connector_sync` | `connectors/sync.py` | One syncer per source (below). |
| `compute_intelligence` | `intelligence/compute.py` | Skill graph, unified projects, ERIS, P(w) widget scoring → `profile_views` |

```bash
cd worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py                                  # run: /health on $PORT + queue loop (what Render runs)
python worker.py                                  # run: queue loop only
python -m unittest discover -s tests -v           # unit tests (no DB, no network)
```

Scanned PDFs and images need the Tesseract binary on the host (`brew install tesseract`, `apt-get install tesseract-ocr`). Without it those jobs end as `needs_review` with a clear `last_error`; text PDFs, DOCX and TXT don't need it.

## Environment

Read from `../.env.local` (or `worker/.env`). Provider keys live **only** here, never in Vercel.

| Env | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` / `WORKER_DATABASE_URL` | | Prefer Neon's direct (non-pooler) URL for this long-lived process |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | | Read uploaded resumes |
| `CONNECTOR_TOKEN_KEY` | | Same value as the web app; opens `connections.token_enc` |
| `GROQ_KEYS`, `GEMINI_KEYS`, `OPENROUTER_KEYS` | | Comma-separated key pools. Logged by label (`groq_1`…), never by value. Text: Groq → Gemini → OpenRouter; images: Gemini → OpenRouter |
| `GEMINI_MODELS`, `OPENROUTER_MODELS`, `OPENROUTER_VISION_MODELS` | see `provider_router.py` | Model overrides (`model[:strict\|json]`). Defaults checked live: `gemini-3.5-flash(-lite)`, free OpenRouter `nvidia/nemotron-3.5-super-vl:free` |
| `GROQ_MODELS` | `openai/gpt-oss-120b:strict,openai/gpt-oss-20b:strict` | Tried in order. `strict` = JSON-schema structured output; `json_object` = JSON mode |
| `WORKER_LOCAL_STORAGE_DIR` | unset | Dev/tests: read `<dir>/<storage_key>` instead of R2 |
| `WORKER_ID` | `host:pid` | Written to `jobs.locked_by` |
| `WORKER_LOCK_SECONDS` | `300` | How long a claim is held before another worker may reclaim it |

## Resume pipeline

1. **Intake:** at most 10 MB, magic bytes must match the declared type, SHA-256 must equal `files.sha256`. Failures are `needs_review` and not retried.
2. **Text, multi-tier:** PyMuPDF with two-column reading order; pages with almost no text are OCR'd with Tesseract at 300 dpi. If the whole text layer is garbage (`resume/quality.py:is_text_usable`: too few words, mostly digits like "1 1 1 1", symbol soup, no resume vocabulary), every page is OCR'd instead.
   **Whole-document fallback** (`needs_whole_document`): when the text is still unusable, the rules find nothing, ≥ 20% of PDF text blocks extract blank (fonts without a Unicode map, typically a designed header), or no name/email is readable, one comprehensive call extracts all 10 groups: from page images (≤ 4 pages, 130 dpi PNG) via vision models for PDFs and images, otherwise from the full text. Vision results are verified against whatever text exists; a vision fact whose quote can't be found there is kept only as `unresolved` with confidence 0.4 (the user checks it in review), and only if its value appears in its own quote and passes type checks. A page whose OCR confidence is below 0.70 is uncertain, and its facts get lower confidence and `validation_status = unresolved`. DOCX keeps body order, tables included; DOCX and TXT have no page numbers.
3. **Deterministic:** sections (own-line or inline headers), email, phone, profile URLs, education entries (institution, degree, dates, grade), name heuristic, and skills from `skills_catalog.py`. Short or common-word aliases only count inside a Skills section.
4. **LLM recovery:** only for groups left thin (name below 0.85 confidence, no complete education entry, fewer than 3 skills, and experience, projects and similar sections that rules don't parse). It sends **only that section's text**, and only with `external_ai` consent, through `provider_router.py`.
5. **Verification:** each `evidence_span` must be found in the section (exact, or fuzzy ≥ 0.90 after normalization), the value must be supported by that span, and it must pass a type check. Failures are dropped and logged. If an LLM value disagrees with a deterministic one, both are kept with `validation_status = conflicting`.
6. **Persist:** facts are written with `origin = resume`, `confirmation = unconfirmed`, `location = {page, bbox}`. This replaces the previous upload's *unreviewed* facts only.

Methods recorded: `deterministic`, `ocr` (deterministic on OCR text), `llm:groq`, `ocr+llm:groq`.

## Queue semantics

- Claims use `FOR UPDATE SKIP LOCKED`, so any number of workers can run in parallel without double-processing.
- A failure is retried with backoff (30 s, 60 s, …) until `max_attempts`, then marked `failed`. Raise `jobs.NeedsReview` to stop without retrying.
- If a worker dies, its lock expires and the job is picked up again. If that was the job's final attempt, it is marked `failed` instead.
- Every outcome write is fenced on `locked_by`, so a worker whose lock was taken over can't overwrite the new owner's result.
- A finished `connector_sync` queues `compute_intelligence` (once onboarding is done, and only if none is already waiting).

## Not built yet (deliberately not faked)

- ClamAV scanning: `files.scan_status` stays `pending`.
- The cross-user hash cache.
- Gemini for uncertain OCR pages.
- Gemini and OpenRouter in the provider chain.
- These tables: `provider_calls` (calls are logged instead), `job_diagnostics` (logged), `fact_conflicts` (conflicts are flagged on the facts), `raw_snapshots`, `widget_prefs`, and the config tables (`intelligence/config.py` stands in).
- GitHub README, commits and PRs.
- Inferred prerequisite skills.
- ERIS problem-solving (LeetCode/HackerRank): reported as missing, and the other weights are renormalized.

## Connectors

| Source | How | Writes (origin) | Needs |
| --- | --- | --- | --- |
| GitHub | OAuth token → REST API | repos, languages, profile (`github`) + `code_repositories` | GitHub OAuth App on the web app |
| LinkedIn | Apify actor `harvestapi~linkedin-profile-scraper` on the user's own public URL (no cookies, ~$0.004/profile) | identity, experience, education, skills, certifications, awards, projects, publications, languages (`linkedin_scrape`) | `APIFY_TOKENS`; **`linkedin_scrape` consent** (job parks as needs_review until granted, then the web app re-queues it) |
| Kaggle | user's kaggle.json (username + key) | notebooks/datasets → projects, entered competitions → achievements, languages → skills (`kaggle`) | — |
| Stack Exchange | public API + `STACK_EXCHANGE_KEY` | top tags → skills, reputation/badges → achievements (`stack_exchange`) | — |
| LeetCode | public GraphQL (`leetcode.com/graphql`) | solved counts + contest rating → achievements, languages → skills (`leetcode`) | — |
| HackerRank | public REST (`/rest/hackers/<u>/badges`) | badges → achievements + skills (`hackerrank`) | — |
| Portfolio | Firecrawl → markdown → resume extractors (rules; LLM with consent) | anything on the page, evidence-verified against the markdown (`portfolio`) | `FIRECRAWL_KEYS`; `external_ai` consent for the LLM pass (re-queued when granted) |

Each sync replaces that source's facts wholesale, marks the connection `connected` with `last_sync_at`, and queues `compute_intelligence`. LeetCode/HackerRank stats also feed ERIS's problem-solving component. Mappers are pure functions (`map_*`) with unit tests on response shapes captured live.
