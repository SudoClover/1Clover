# PROGRESS — live build state for Clover

> **The source of truth for *current state*** (CLAUDE.md §13). Read this at the
> start of every session, after CLAUDE.md. Update it at the **end of every
> session** (and before any compaction): per slice — status, last test/CI result,
> key decisions + why, and the concrete next step. **Keep it concise: state, not a
> diary.** The plan is in [ROADMAP.md](ROADMAP.md); stable memory in
> [CLAUDE.md](CLAUDE.md).

**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Done (CI green on its own
runner) · ⛔ Blocked.

---

## Current session

- **Phase:** Slice 2 — Media upload spine. **Implementation COMPLETE; all test
  suites green locally; not yet committed/pushed — awaiting CI on a PR.** (CI is the
  authority on done — CLAUDE.md §6.)
- **Last update:** 2026-06-21.
- **Slice 0:** ✅ DONE — PR #1 (`e1e1299`). **Slice 1:** ✅ DONE — PR #2 (`2463c36`).
  `main` is branch-protected (4 required checks + PR-only; no force-push/delete;
  admin override retained).
- **Slice 2 — what was built** (the proof-of-spine: authed upload → board):
  - `media` table + 3 shared enums (`media_kind`/`moderation_state`/`processing_state`)
    + RLS (public read of approved/ready only; owner reads own; **no client writes**;
    storage_key/checksum/byte_size hidden) — schema + reviewed migration + pgTAP (19).
    **Hand-added the `REVOKE ALL` the diff tool drops** (same trap as profiles).
  - Pure `src/lib/domain/upload-policy/` — magic-byte sniff, **SVG ban**, allowlist,
    declared/actual mismatch (polyglot/spoof guard), size + pixel/dimension caps. Unit-tested.
  - `src/lib/server/media/` — dependency-injected `runMediaPipeline` (validate →
    re-encode → thumbnail → classify → flip state), seams: `MediaStore` (R2 / fs-dev),
    `ImageProcessor` (sharp Node / Images prod-deferred), `Classifier` (stub), service-role
    `repo`/sink + `dispatch` (enqueue prod / pending dev).
  - `POST /api/upload` (auth-gated, server-side row insert + dispatch), `GET /media/[...key]`
    (dev serving of safe/thumb only, `nosniff`), board `/` + `MediaCard`, `/upload` UI (guarded).
  - `workers/media-consumer/` (queue handler) + `wrangler.toml`; pool-workers test of the
    consumer with **real R2 bindings**.
  - Decisions in **[ADR-0012](docs/adr/0012-slice2-media-spine-buildtest.md)** (no-spend
    realization of ADR-0007: endpoint-upload now / presign at deploy; sharp-Node-dev vs
    Images-prod behind the seam; classifier stub).
- **Local test results (all green):** unit 31 · pgTAP 32 · integration 10 (valid→approved;
  SVG/mismatch/**corrupt**→failed; RLS) · workers 2 (real R2) · E2E 5 (incl. board renders an
  approved card, served `image/webp` + `nosniff`). `pnpm build` clean (sharp/node:fs kept out of
  the workerd bundle). `pnpm audit --audit-level=high` clean. typecheck + lint clean.
- **Reviewer-agent gate (fresh context, read-only):** **APPROVE WITH NITS** — no Critical/Major.
  Applied: markFailed no longer writes the reason into client-readable `variants` (logs it);
  dropped the redundant `media/` key prefix (no more `/media/media/…`); added the end-to-end
  corrupt-image test; documented that the dev serving route is key-obscured not access-controlled
  (Slice 8 signed URLs must gate `held` on `approved`). Animated-GIF flatten accepted (documented).
- **CI changes:** added `pnpm test:workers` to the quality job; the **E2E job now starts
  local Supabase** (board reads approved media + seeds via service role).
- **Deferred to deploy (⛔#2/💳 — brief the overseer then):** create the real R2 bucket +
  Queue, enable **Cloudflare Images** + **Workers AI**, wire the prod `ImageProcessor`, add
  **presigned R2 PUT**, set consumer secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`), and the
  app's prod wrangler bindings (`MEDIA_BUCKET`, `MEDIA_QUEUE`).
- **Out of scope (held):** posts/titles/tags (Slice 3), real AI + human queue (Slice 8),
  multi-file, video/audio, feeds, ratings.
- **First action next session:** commit + push branch `slice-2-media-upload`, open a PR, get
  CI green (force a run via PR close/reopen if needed), then the reviewer-agent gate, then
  overseer merge. Then start Slice 3.
- **Repo gotcha:** GitHub does NOT reliably auto-run CI on push to this repo; force a run by
  closing+reopening the PR. Don't rename a CI job `name:` without updating the
  branch-protection required-check list.

---

## Open items needing the overseer (before the relevant slice)

These are the ❓ items from [ASSUMPTIONS.md](ASSUMPTIONS.md) — confirm before the
slice that depends on them:

- [ ] **Operating jurisdiction = Germany?** (drives Impressum + age threshold) — needed by Slice 13, ideally sooner.
- [x] **Anonymous browsing allowed?** ✅ Yes — public read of approved content/profiles; writes require a verified account. (Confirmed 2026-06-21.)
- [ ] **Minimum age = 16?** — needed by Slice 13 (age gate).
- [ ] **Follows + Friends as two separate graphs?** (default: yes) — needed by Slice 10.
- [ ] **Rating model = single like/upvote?** (default: yes) — needed by Slice 6.
- [x] **#2/💳 gate:** Supabase Pro + Cloudflare accounts created. (Remote project *wiring* — keys/deploy — still pending; needed only for a live deploy, not for Slice 1 CI.)
- [ ] **Minimum age value = 16?** still to confirm with jurisdiction before Slice 13 (column added now).

---

## Slice status

| # | Slice | Status | Last test/CI | Notes |
|---|---|---|---|---|
| 0 | Foundation & CI spine | ✅ Done | CI green on runner (all 4 jobs) | Merged via PR #1 (`e1e1299`); `main` branch-protected |
| 1 | Auth & profiles | ✅ Done | CI green; reviewer APPROVE WITH NITS | Merged via PR #2 (`2463c36`) |
| 2 | Media upload spine (image → board) | 🟡 In progress | all suites green locally; awaiting CI | Code complete; not yet pushed. See session notes + ADR-0012 |
| 3 | Posts & the board proper | ⬜ Not started | — | |
| 4 | Tags, metadata & similar posts | ⬜ Not started | — | |
| 5 | Feeds: New/Hot/Top/Following | ⬜ Not started | — | |
| 6 | Ratings & vote integrity + rate limit | ⬜ Not started | — | |
| 7 | Comments | ⬜ Not started | — | |
| 8 | Trust & Safety (classify/queue/reports) | ⬜ Not started | — | ⛔#2 CSAM code |
| 9 | Blocks + GDPR erasure & export | ⬜ Not started | — | ⛔#2 erasure |
| 10 | Social graph: follows & friendships | ⬜ Not started | — | |
| 11 | Real-time DM between friends | ⬜ Not started | — | |
| 12 | Tool registry + pixel-art editor | ⬜ Not started | — | First creation tool |
| 13 | Legal, compliance & launch hardening | ⬜ Not started | — | ⛔#2 legal/launch |

**Future (unscheduled):** frame-animation tool · photo editor · pgvector
recommendations · video (Stream, 💳⛔#2) · audio · music/video tools · monetization
seam (💳⛔#2) · OAuth/MFA · native mobile. (See [ROADMAP.md](ROADMAP.md).)

---

## Key decisions log (most recent first)

> Significant decisions get an [ADR](docs/adr/); this is the quick chronological
> index. Product/legal/tech assumptions live in [ASSUMPTIONS.md](ASSUMPTIONS.md).

- **2026-06-21** — Slice 2 (media spine) implemented; all suites green locally,
  awaiting CI. New **[ADR-0012](docs/adr/0012-slice2-media-spine-buildtest.md)**:
  realize ADR-0007 with no spend — the pipeline is dependency-injected so the same
  `runMediaPipeline` runs in the prod consumer Worker (R2 + Cloudflare Images), Node
  dev/CI (fs + sharp), and tests (fakes). **sharp can't run in workerd**, so the prod
  re-encoder (Cloudflare Images, deferred) and the Node dev re-encoder (sharp) sit
  behind an `ImageProcessor` seam. Upload goes through `POST /api/upload` for now;
  **presigned R2 PUT deferred to deploy** (untestable without a real bucket; avoids
  shipping unvalidated SigV4). All media writes are service-role; clients have no
  write privilege on `media`. Lesson reconfirmed: `supabase db diff` drops the
  `REVOKE ALL` on new tables — hand-add it (column-privacy + no-client-write depend on it).
- **2026-06-21** — Slice 1 MERGED (PR #2, `2463c36`). Reviewer APPROVE WITH NITS;
  applied L1 (root layout exposes only `signedIn`, not the session/tokens). Lessons:
  GitHub auto-trigger on push is unreliable in this repo (force CI via PR
  close/reopen); renaming a CI job `name:` breaks its branch-protection
  required-check binding — update the protection contexts when renaming.
- **2026-06-21** — Slice 1 (#2 auth gate) APPROVED. Choices: email confirmation
  required; public browsing + sign-in to participate; `birthdate` column added now,
  under-16 enforcement deferred to Slice 13. Email/password only at launch
  (OAuth/MFA later). Also: Slice 0 merged (PR #1, `e1e1299`) + `main` branch
  protection enabled (4 required checks, PR-only, no force-push/delete).
- **2026-06-21** — Slice 0 reviewer-agent gate (fresh context, read-only):
  **APPROVE WITH NITS**. Fixed: M1 (seed `sql_paths` → no-match glob so `db reset`
  doesn't choke on a missing `seed.sql`), M2 (`schema_paths` wired to
  `./schemas/*.sql` + created `supabase/schemas/` + `supabase/migrations/`), L2
  (pinned Supabase CLI to 2.107.0 in CI), N3 (CI comment on the sync lifecycle).
  Accepted/deferred: L1 (SCA `pnpm audit` may block on unrelated future advisories
  — a policy call for the overseer), Semgrep version pin (after first green CI run),
  L3/N1/N2/N4 (minor — Docker image caching, dev-server E2E, deferred wrangler.toml,
  placeholder format).
- **2026-06-21** — Slice 0 scaffold built: SvelteKit (Svelte 5) + adapter-cloudflare,
  Vitest, Playwright, ESLint flat config (`no-explicit-any` error), Prettier (tabs;
  long-form `.md` excluded), local Supabase via CLI, and a CI workflow with
  quality / database (pgTAP) / E2E / security (gitleaks + `pnpm audit` + Semgrep)
  jobs. Technical notes: pnpm `allowBuilds` for esbuild/sharp/workerd; E2E runs
  against `vite dev` (adapter-cloudflare has no `vite preview`) until deploy is
  wired; pnpm installed to a user prefix in this env (Node 26, no corepack).
- **2026-06-21** — Overseer interview completed. Confirmed: ~$25–50/mo budget;
  desktop-first responsive web; pixel-art tool first; SFW-now (NSFW headroom);
  no monetization (clean seam); overseer is sole moderation/DSA/Impressum/CSAM
  owner; buy managed media (Cloudflare); pragmatic EU residency (EU DB / global
  CDN). See [ASSUMPTIONS.md](ASSUMPTIONS.md).
- **2026-06-21** — Architecture set: SvelteKit on Cloudflare Workers + Supabase
  (EU) + R2/CDN; single repo; in-process tool registry; metadata/tags before
  pgvector. See [RESEARCH.md](RESEARCH.md) + ADRs 0001–0011.

---

## Blockers

- None (planning phase). The only gating dependency is overseer approval of the
  plan + project/credential setup for Slice 0.
