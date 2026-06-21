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

- **Phase:** Slice 2 — Media upload spine (NOT STARTED; branch
  `slice-2-media-upload` created with this plan). **Recommended: begin in a fresh
  session** (this planning+Slice0+Slice1 session is long).
- **Last update:** 2026-06-21.
- **Slice 0:** ✅ DONE — PR #1 (`e1e1299`). **Slice 1:** ✅ DONE — PR #2
  (`2463c36`); reviewer APPROVE WITH NITS (L1 applied), all 4 CI jobs green.
  `main` is branch-protected (4 required checks + PR-only; no force-push/delete;
  admin override retained).
- **Slice 2 plan (the proof-of-spine — "upload one image → it appears on the board"):**
  authed user uploads ONE image → presigned R2 PUT (server-generated key) → enqueue
  a Cloudflare Queue → consumer Worker validates (magic bytes, size/pixel caps,
  **SVG banned**, reject polyglots) → re-encode + thumbnail → classify **STUB**
  (auto-approve in dev) → flip `media.moderation_state` pending→approved → the board
  shows approved media.
  - **Local/CI approach (no spend):** miniflare for R2 + Queues bindings;
    `@cloudflare/vitest-pool-workers` for the consumer with real bindings; `sharp`
    (already build-allowed) for local re-encode/thumbnail; classifier = stub.
  - **Deferred to deploy (⛔#2/💳 — NOT needed for Slice 2 CI):** create the real R2
    bucket + Queue, enable Cloudflare Images + Workers AI. Brief the overseer then.
  - **Files:** `supabase/schemas` (media table + RLS) + migration + pgTAP;
    `src/lib/domain/upload-policy/` (pure: allowlist, caps, magic-byte sniff);
    `src/lib/server/media/` (presign, key-gen, enqueue); `src/routes/api/upload`;
    `workers/media-consumer/`; `wrangler` R2+Queue bindings; board + `MediaCard`;
    integration + worker tests; CI: add the worker-pool tests to the matrix.
  - **Out of scope (binding):** posts/titles/tags (Slice 3), real AI + human queue
    (Slice 8), multi-file, video/audio, feeds, ratings.
- **First action next session:** read this + CLAUDE.md; confirm on branch
  `slice-2-media-upload`; design the `media` table + RLS and the pure `upload-policy`
  domain module first (test-first), then the consumer Worker.
- **Repo gotcha:** GitHub does NOT reliably auto-run CI on push to this repo; force a
  run by closing+reopening the PR (or add a `workflow_dispatch` trigger). Don't
  rename a CI job `name:` without updating the branch-protection required-check list.

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
| 2 | Media upload spine (image → board) | 🟡 In progress | branch + plan only | The proof-of-spine; see plan above |
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
