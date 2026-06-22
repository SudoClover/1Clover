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

- **Phase:** Slice 5 — Feeds (New/Hot/Top/Following) **✅ DONE & merged** (PR #8, merge `c7cde19`;
  all 4 CI jobs green on the runner across both pushes; reviewer pass — **APPROVE WITH NITS**, no
  blockers; N2 + L1 applied in `5cc502e`). Suites: **69 unit / 25 integration / 99 pgTAP / 9 E2E**.
  Decisions ([ADR-0015](docs/adr/0015-feeds-hot-score-and-follows.md)): **epoch-additive Reddit
  `hot_score`** (recompute only on rating change, **no cron**); **Hot keyset via a SQL RPC
  `hot_feed_page`** (cursor = last id — PostgREST truncates float8, so a float cursor dup'd/skipped
  rows, proven + caught by an integration test); **minimal read-only `follows` table** added now
  (overseer call) driving Following, with the follow **button deferred to Slice 10**. No ratings
  yet → **Hot mirrors New, Top = recency-within-window** (the stable seam Slice 6 fills).
  **Next: Slice 6 — Ratings & vote integrity + rate limiting** — start in a fresh session.
  ⚠️ Overseer item first: confirm **rating model = single like/upvote?** (default yes; see Open items).
- **Slice 4 — Tags, metadata & "similar posts"** **✅ DONE & merged** (PR #6, merge `5674402`;
  all 4 CI jobs green; two reviewer passes — APPROVE → APPROVE WITH NITS after `1a41d6a`).
  Tags-only (overseer: **no `posts.metadata` column**); similarity = tag overlap behind the
  stable pure `findSimilar` seam ([ADR-0014](docs/adr/0014-tags-and-similar-posts.md)).
- **Slice 3 — Posts & the board proper** **✅ DONE & merged** (PR #4 merge `fbf62da`;
  drift-audit cleanups PR #5 merge `5e71f22`; all CI green).
- **Last update:** 2026-06-22.
- **Slices 0–2:** ✅ DONE & merged — PR #1 (`e1e1299`), PR #2 (`2463c36`), **PR #3
  (`aafd78a` / merge `11d0255`)**. Slice 2 reviewer gate APPROVE WITH NITS (applied);
  all 4 CI jobs green. `main` is branch-protected (4 required checks + PR-only).
  Deferred Slice-2 deploy items (⛔#2/💳): real R2 bucket + Queue, Cloudflare Images,
  Workers AI, presigned R2 PUT, consumer secrets, app prod wrangler bindings — brief
  the overseer at the deploy gate. (Built media: `media` table, `upload-policy` domain,
  `runMediaPipeline` + seams, `/api/upload`, `/media/[...key]`, consumer worker; see
  [ADR-0012](docs/adr/0012-slice2-media-spine-buildtest.md).)
- **Slice 3 (shipped) — what's on `main`:** `posts`/`post_media` + RLS + `edited_at`
  trigger + the atomic **`create_post`** RPC (SECURITY INVOKER; author from `auth.uid()`;
  execute → `authenticated` only); pure `src/lib/domain/posts/`; `src/lib/server/db/posts.ts`
  (keyset board, detail, create/edit/delete, library) on the **authed per-request client**;
  posts board `/` (Masonry/PostCard + infinite scroll via `/api/board`), `post/[id]` detail,
  `/create` (guarded). XSS-safe (text render, never `{@html}`). Clients still can't write
  `moderation_state`/`edited_at`. Tests: 42 unit / 16 integration (two-user RLS, atomic
  rollback, keyset) / 61 pgTAP / 8 E2E. See [ADR-0013](docs/adr/0013-client-writable-posts-atomic-create.md).
- **Slice 4 (shipped) — what's on `main`:** `tags` (global/shared, `name` charset `CHECK`) +
  `post_tags` join + RLS (mirrors `post_media`) + the **`set_post_tags`** SECURITY INVOKER RPC
  (owner-checked, atomic relink); pure `src/lib/domain/tags/` + `src/lib/domain/recommend/find-similar.ts`;
  `src/lib/server/db/tags.ts` (coarse DB filter → pure `findSimilar`, reuses `posts.ts` cover helpers);
  `/api/posts/[id]/similar`; tag input on create + owner-edit; tag chips + `SimilarPosts` on detail
  (escaped text). Tests: 57 unit / 19 integration / 80 pgTAP / 8 E2E. `posts.ts` now 209 lines (1 over
  soft from an export comment — new code lives in `tags.ts`). See [ADR-0014](docs/adr/0014-tags-and-similar-posts.md).
  **Deferred follow-up (reviewer [Low], non-blocking):** `getSimilarPosts` 200-row candidate cap has no
  `ORDER BY`, so at scale (a tag with >200 posts) it can truncate before ranking — ADR-accepted as coarse
  until pgvector; fold the deterministic-cap fix into the pgvector slice.
- **Slice 5 (built, on `slice-5-feeds`):** pure `src/lib/domain/feed/` (`hotScore`, `windowStart`,
  mode/window parsing); `src/lib/server/db/feeds.ts` (Hot/Top/Following, reusing `posts.ts` cover
  helpers); unified **`/api/feed?mode=…`** (replaced `/api/board`); `posts.hot_score` column +
  `posts_hot_idx` + `set_post_hot_score` BEFORE-INSERT trigger + the **`hot_feed_page`** keyset RPC
  (SECURITY INVOKER, id cursor); minimal read-only **`follows`** table (RLS: own-edges SELECT only);
  `FeedSwitcher` + per-mode empty states on `/`. Clients can't write `hot_score` (no grant) and
  can't write `follows` (no grant). Integration set `fileParallelism:false` (shared DB → serialize).
  Tests: **69 unit / 25 integration / 99 pgTAP / 9 E2E**, green locally. See
  [ADR-0015](docs/adr/0015-feeds-hot-score-and-follows.md). **Reaffirm at Slice 6:** add the SQL
  log10(score) term to `set_post_hot_score` + a SQL↔TS parity test; switch Top's primary sort to
  rating count (interfaces already stable). **Reviewer pass (fresh context, read-only): APPROVE
  WITH NITS, no blockers** — verified no client write on `hot_score`/`follows`, RPC is SECURITY
  INVOKER + approved-only, cursor-injection blocked, `getClaims()` authz, formula parity. Applied:
  explicit `SECURITY INVOKER` in the migration (N2) + a deleted-cursor trade-off comment (L1).
  **Deferred (non-blocking):** (L1) Hot pagination ends early if the cursor post is deleted/held
  mid-scroll (boundary CTE empty → empty page; refresh fixes; no dup/skip) — revisit if it bites;
  (L2) `MAX_FOLLOWEES=1000` cap silently drops authors for a heavy follower — fold into Slice 10
  when the follow write surface lands.
- **Drift audit (CLAUDE.md §11, Slices 0–3) — 2026-06-22:** **On track; no architectural or
  security drift.** Confirmed: layers respected, `getClaims()` only, RLS + column grants, no
  premature columns/tables/features. 3 trivial cleanups applied on `chore/slice-3-followups`:
  this PROGRESS marked Done, deleted dead `MediaCard.svelte` (Slice-2 leftover, 0 refs), added
  ADR-0013 to the ADR index. (`posts.ts` at ~208 lines — watch the 200 soft limit if Slice 4 grows it.)
- **E2E note (still relevant):** UI form-login is a hydration-race flake in Playwright; the repo
  keeps UI auth out of E2E (`e2e/auth.test.ts`). Authed create/edit/delete are proven by the
  **integration** suite against real RLS; E2E covers the anonymous board→detail render + the
  `/create` guard + a malformed-cursor 400.
- **Out of scope (binding) for shipped/in-flight slices:** ratings & vote integrity (Slice 6),
  comments (Slice 7), the follow **button**/friendships (Slice 10). `hot_score` is built (Slice 5)
  but carries no popularity signal until ratings; no `rating_count/sum`/`comment_count`/`metadata`
  columns yet (additive in their slices); pgvector, tag moderation & trending tags remain out of
  scope ([ADR-0014](docs/adr/0014-tags-and-similar-posts.md), [ADR-0015](docs/adr/0015-feeds-hot-score-and-follows.md)).
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
| 3 | Posts & the board proper | ✅ Done | CI green (PR #4); reviewer APPROVE; drift audit clean | Merged `fbf62da`. Atomic `create_post` RPC; keyset board; see ADR-0013 |
| 4 | Tags, metadata & similar posts | ✅ Done | CI green (PR #6); reviewer APPROVE / APPROVE WITH NITS | Merged `5674402`. `tags`+`post_tags`+RLS+`set_post_tags` RPC; pure `findSimilar`; `/api/posts/[id]/similar`; tag UI. Tags-only (no `metadata` col); see ADR-0014 |
| 5 | Feeds: New/Hot/Top/Following | ✅ Done | CI green (PR #8); reviewer APPROVE WITH NITS | Merged `c7cde19`. Epoch-additive `hot_score` (no cron); Hot keyset via `hot_feed_page` RPC (float cursor doesn't round-trip); minimal read-only `follows`; Hot≈New, Top=recency until ratings (Slice 6). See ADR-0015 |
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

- **2026-06-22** — Slice 5 (feeds) **built** on `slice-5-feeds`; all local suites green (69 unit /
  25 integration / 99 pgTAP / 9 E2E). **Decisions ([ADR-0015](docs/adr/0015-feeds-hot-score-and-follows.md),
  refines ADR-0006):** (a) **epoch-additive Reddit `hot_score`** = `log10(max(score,1)) + epoch/45000`
  — absolute-time term means recompute is needed only on **rating change** (Slice 6), **no cron**
  (drops ADR-0006's scheduled recompute, no spend). (b) **Hot paginates via a SQL keyset RPC**
  (`hot_feed_page`, cursor = last id): PostgREST truncates `float8` to ~15 digits so a `hot_score`
  float cursor **doesn't round-trip** → dup'd/skipped rows at page edges (probed + caught by an
  integration test); New/Top/Following keyset on `(created_at,id)` (text, exact). (c) **Minimal
  read-only `follows` table** added now (overseer call) — Following works + is tested; the follow
  **button + write policies are Slice 10**. (d) No ratings yet → Hot mirrors New, Top = recency in
  window. **Lessons:** `db diff` again dropped the `REVOKE ALL` on the new `follows` table + the
  function `REVOKE EXECUTE … FROM public` (hand-added both) + re-emitted the no-op `post_media`
  grant reshuffle (dropped). Integration files share one DB → set `fileParallelism:false`.
- **2026-06-22** — Slice 4 (tags + "similar posts") **merged** (PR #6, merge `5674402`); all 4
  CI jobs green on the runner; two independent reviewer passes (APPROVE → APPROVE WITH NITS).
  Suites: 57 unit / 19 integration / 80 pgTAP / 8 E2E. **Decision
  ([ADR-0014](docs/adr/0014-tags-and-similar-posts.md)):** **tags-only this slice — no
  `posts.metadata` column** (overseer call; the ROADMAP *Touches* list + scope discipline
  win over the goal-line prose). `tags` is global/shared; `post_tags` is the owner-owned join
  (RLS mirrors `post_media`); a post's tags are replaced atomically by a **`set_post_tags`
  SECURITY INVOKER RPC** (get-or-create + relink, explicit owner check). Similarity = **coarse
  DB filter + pure `findSimilar`** (shared-tag count, deterministic tie-break) — the stable
  seam pgvector slots into later; `/api/posts/[id]/similar` is the stable interface. Tag input
  normalized/charset-capped in pure domain code + a DB `CHECK` backstop. **Lessons reconfirmed:**
  `db diff` drops both the table `REVOKE ALL` *and* the function `REVOKE EXECUTE … FROM public`
  — hand-add both (did); it also emitted a no-op `post_media` grant reshuffle — dropped it.
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
