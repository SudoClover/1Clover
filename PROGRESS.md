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

- **Phase:** Planning (architecture + plan only — no production code, by design).
- **Last update:** 2026-06-21.
- **Last CI status:** n/a (no code yet).
- **Concrete next step:** Overseer reviews & approves the planning docs
  (RESEARCH / ARCHITECTURE / ROADMAP / CLAUDE / ASSUMPTIONS / ADRs). On approval,
  a future session starts **Slice 0 — Foundation & CI spine**. Before Slice 0 can
  finish, the **overseer must create the Supabase + Cloudflare projects and hold
  their credentials** (the agent never holds prod creds).

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
| 0 | Foundation & CI spine | ⬜ Not started | — | Needs overseer to create projects + hold creds (⛔#2/💳) |
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
