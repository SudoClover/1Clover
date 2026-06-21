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

- **Phase:** Slice 3 — Posts & the board proper. **IMPLEMENTATION COMPLETE locally**
  on branch `slice-3-posts-board` (off `main`); awaiting CI on its own runner + the
  reviewer gate before merge.
- **Last update:** 2026-06-22.
- **Slices 0–2:** ✅ DONE & merged — PR #1 (`e1e1299`), PR #2 (`2463c36`), **PR #3
  (`aafd78a` / merge `11d0255`)**. Slice 2 reviewer gate APPROVE WITH NITS (applied);
  all 4 CI jobs green. `main` is branch-protected (4 required checks + PR-only).
  Deferred Slice-2 deploy items (⛔#2/💳): real R2 bucket + Queue, Cloudflare Images,
  Workers AI, presigned R2 PUT, consumer secrets, app prod wrangler bindings — brief
  the overseer at the deploy gate. (Built media: `media` table, `upload-policy` domain,
  `runMediaPipeline` + seams, `/api/upload`, `/media/[...key]`, consumer worker; see
  [ADR-0012](docs/adr/0012-slice2-media-spine-buildtest.md).)
- **Slice 3 — built end-to-end; ALL local suites green; not committed yet:**
  - **DB:** `supabase/schemas/03_posts.sql` — `posts` (id, author_id, title≤140,
    description≤2000, moderation_state default **approved**, created_at, edited_at) +
    `post_media` (post_id, media_id, position, PK) + RLS + `edited_at` trigger + the
    **`create_post(p_title, p_description, p_media_ids[])` RPC** (SECURITY INVOKER →
    atomic post+links under RLS; author_id from `auth.uid()`; execute granted to
    `authenticated` only). Migration `20260621221225_create_posts.sql` hand-reviewed:
    **both table `REVOKE ALL` + the function `REVOKE EXECUTE FROM public,anon` hand-added**
    (diff drops them — security-critical). pgTAP `03_posts_rls.test.sql` now **29 tests**
    (added has_function + execute-privilege). Types regenerated (includes `create_post`).
  - **Domain (pure):** `src/lib/domain/posts/post-input.ts` (+`types.ts`) — title/description
    caps, ≥1-media + cap(20) + uuid checks, trim/dedupe. Unit-tested.
  - **Server:** `src/lib/server/db/posts.ts` — `getBoardPage` (keyset cursor on
    `(created_at,id)`, cover = lowest-`position` approved+ready thumb), `getPostById`,
    `createPost` (RPC), `updatePost`/`deletePost` (RLS), `listPostableMedia`. Uses the
    **authed per-request client**, not service-role.
  - **UI:** board `/` rewritten to **posts** (Masonry + PostCard + IntersectionObserver
    infinite scroll via `/api/board`); `post/[id]` detail (PostDetail) + owner edit/delete;
    `/create` (pick from own approved library → `create_post`); `/create` added to the
    authGuard. Title/description rendered as text (`{…}`, never `{@html}`) → escaped.
  - **Tests green locally:** unit **42**, integration **16** (incl. 6 new two-user posts:
    create→board→detail, approved-only public + owner-sees-own-held, owner edit/delete +
    non-owner denied via RLS, atomic rollback when linking unowned media, keyset paging),
    pgTAP **61**, E2E **7** (board render + served-cover nosniff/webp, board→detail, /create
    guard), lint clean, typecheck 0/0. New **[ADR-0013](docs/adr/0013-client-writable-posts-atomic-create.md)**.
  - **NEXT (precise):** commit (conventional `feat:`) → push → **force CI** via PR
    open/close-reopen (auto-trigger unreliable in this repo) → reviewer-agent gate (fresh
    context, read-only) → address findings → merge. **Drift audit is due** (Slices 1–3, per
    CLAUDE.md §11) — run it around this merge.
  - **E2E note (decision):** UI form-login is **flaky in E2E** (SvelteKit enhance vs
    hydration race: native submit can land back on `/login`); the repo already keeps UI auth
    out of E2E (`e2e/auth.test.ts`). So posts E2E seeds via service-role and tests the
    anonymous board→detail render journey + the `/create` guard; the authed create/edit/delete
    paths are proven by the posts **integration** suite against real RLS.
- **Out of scope (binding):** tags/metadata (Slice 4), feeds/ranking (Slice 5), ratings
  (Slice 6), comments (Slice 7), similar posts. No counters/`hot_score` columns yet
  (additive in their slices).
- **Repo gotcha:** GitHub does NOT reliably auto-run CI on push; force a run via PR
  close/reopen. Don't rename a CI job `name:` without updating the branch-protection
  required-check list. `supabase db diff` drops `REVOKE`/grants — hand-add them.

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
| 2 | Media upload spine (image → board) | ✅ Done | CI green (PR #3); reviewer APPROVE WITH NITS | Merged `11d0255`. Deploy items deferred (#2/💳); see ADR-0012 |
| 3 | Posts & the board proper | 🟡 In progress | all local suites green (42 unit/16 int/61 pgTAP/7 E2E); awaiting CI + reviewer | `slice-3-posts-board`; built end-to-end; see session notes + ADR-0013 |
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

- **2026-06-22** — Slice 3 built end-to-end (posts/post_media + board + detail + create +
  owner edit/delete); all local suites green. **Decision ([ADR-0013](docs/adr/0013-client-writable-posts-atomic-create.md)):**
  posts are the first client-writable tables, so writes use the **authed per-request
  client + RLS** (not service-role). Create goes through a **`SECURITY INVOKER`
  `create_post` RPC** so the post + its `post_media` links commit **atomically** under
  RLS (linking unowned media rolls the whole post back — proven in integration); a
  reusable template for ratings/comments. Board is the **New** feed: approved-only, keyset
  `(created_at,id)` cursor, cover = lowest-`position` approved thumb. XSS handled by
  rendering title/description as text (never `{@html}`). **Lessons:** (a) `db diff` also
  drops the default `PUBLIC` execute grant on functions — hand-maintain
  `REVOKE EXECUTE … FROM public,anon` + grant to `authenticated`; (b) UI form-login is a
  hydration-race flake in Playwright — keep authed flows in integration tests (repo
  convention), seed E2E via service-role.
- **2026-06-21** — Slice 2 MERGED (PR #3, merge `11d0255`); all 4 CI jobs green.
  Slice 3 started on `slice-3-posts-board`. **Decision:** `posts.moderation_state`
  defaults to `approved` — post text is moderated reactively (reports/queue, Slice 8);
  the gated proactive payload is media (Slice 2). Posts/post_media are the first
  **client-writable** tables (owner insert/update/delete via RLS; `moderation_state`
  not in the client column grants so users can't self-un-hold).
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
