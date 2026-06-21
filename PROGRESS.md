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

- **Phase:** Slice 0 — Foundation & CI spine (implementation, branch
  `slice-0-foundation`).
- **Last update:** 2026-06-21.
- **Last CI status:** No remote yet, so CI has **not** run (CI is the authority on
  "done" — Slice 0 is therefore *not* complete). **Locally verified green:**
  `typecheck`, `test` (1 unit), `lint` (prettier + eslint), `build`
  (adapter-cloudflare), Playwright E2E smoke. **Not locally verified** (wired for
  CI): the `database` job (Docker daemon not running here) and the `security` job
  (gitleaks/semgrep not installed locally; `pnpm audit` ran clean — 1 low).
- **Concrete next step:** Overseer to (1) create the GitHub repo + push so CI runs
  the full matrix, and (2) create the Supabase + Cloudflare projects and hold the
  credentials (⛔#2/💳, incl. Supabase Pro ~$25/mo). Once CI is green on its runner,
  mark Slice 0 ✅ and start **Slice 1 — Auth & profiles**.

---

## Open items needing the overseer (before the relevant slice)

These are the ❓ items from [ASSUMPTIONS.md](ASSUMPTIONS.md) — confirm before the
slice that depends on them:

- [ ] **Operating jurisdiction = Germany?** (drives Impressum + age threshold) — needed by Slice 13, ideally sooner.
- [ ] **Anonymous browsing allowed?** (default: yes, read-only) — affects RLS in Slice 1/3.
- [ ] **Minimum age = 16?** — needed by Slice 13 (age gate).
- [ ] **Follows + Friends as two separate graphs?** (default: yes) — needed by Slice 10.
- [ ] **Rating model = single like/upvote?** (default: yes) — needed by Slice 6.
- [ ] **#2/💳 gate:** approve creating Supabase/Cloudflare projects + enabling Supabase Pro (~$25/mo) — needed to finish Slice 0.

---

## Slice status

| # | Slice | Status | Last test/CI | Notes |
|---|---|---|---|---|
| 0 | Foundation & CI spine | 🟡 In progress | local: quality+unit+build+e2e green; DB/security pending CI | Scaffold done on `slice-0-foundation`. Needs remote (CI) + overseer projects/creds (⛔#2/💳) |
| 1 | Auth & profiles | ⬜ Not started | — | |
| 2 | Media upload spine (image → board) | ⬜ Not started | — | The proof-of-spine slice |
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
