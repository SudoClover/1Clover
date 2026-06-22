# ROADMAP — Clover build plan

> **An ordered list of vertical slices.** Each slice is a thin, runnable, testable
> end-to-end feature. Ordered by dependency. Build **only the current slice**; its
> **Out of scope** list is binding ([CLAUDE.md](CLAUDE.md) §8).
>
> Each slice has: **Goal · Touches · Out of scope · Verify (CI is the authority)
> · 🔒 Threat notes** (inline so the security context is present when the code is
> written — Autonomy guardrail #6).
>
> Live status is in [PROGRESS.md](PROGRESS.md); decisions in
> [docs/adr/](docs/adr/); shape in [ARCHITECTURE.md](ARCHITECTURE.md).
>
> **Gate markers:** ⛔#2 = a slice that contains a #2 human gate (stop + plain-
> language brief + overseer approval before that step). 💳 = commits money.

---

## Slice 0 — Foundation & CI spine ⛔#2(💳 paid tiers when enabled)

**Goal.** An empty-but-real SvelteKit app that runs locally, a local Supabase that
resets cleanly, and **green CI** with every gate wired (even if mostly trivial).
This proves the *verification* spine before any feature.

**Touches.** `package.json`, `pnpm-lock.yaml`, SvelteKit + `adapter-cloudflare`
scaffold, `wrangler.toml`, `vite`/`svelte`/`ts`/`eslint`/`prettier` configs,
`supabase/` (init, empty schema, `db reset` works), `.github/workflows/ci.yml`
(lint/typecheck/format/test/SAST/SCA/gitleaks placeholders), `.gitignore`,
`.env.example`, `src/routes/+page.svelte` (hello), `/healthz` endpoint, a trivial
unit test + a trivial pgTAP test.

**Out of scope.** Any feature, auth, uploads, real schema, prod deploy.

**Verify.** CI green on a PR; `pnpm dev` serves the page; `supabase db reset`
rebuilds cleanly; `/healthz` returns ok; gitleaks runs.

**🔒 Threat notes.** Establish secret hygiene from commit #1: `.gitignore` all
`.env*`/`.dev.vars`, `.env.example` placeholders only, gitleaks + GitHub push
protection on. **⛔#2 / 💳:** creating the Supabase/Cloudflare projects and
enabling any paid tier is a money/vendor gate — overseer does this and holds the
credentials; the agent never holds prod creds.

---

## Slice 1 — Auth & profiles (identity spine)

**Goal.** A user can sign up (email/password + verification), log in/out, reset
password; a `profiles` row is auto-created; a protected route is gated by
`getClaims()`. This is the prerequisite for every user-owned feature.

**Touches.** `supabase/schemas/` (`profiles` + signup trigger + RLS),
`supabase/migrations/`, `supabase/tests/` (RLS pgTAP), `src/lib/server/supabase.ts`
(per-request client), `src/lib/server/auth/`, `src/routes/(auth)/**` (signup/login/
reset), `hooks.server.ts` (session refresh, guard), `src/lib/types/database.ts`.

**Out of scope.** OAuth, MFA, Turnstile (Slice with anti-abuse), avatars (need
media), follows/friends, the age gate's legal copy.

**Verify.** Integration: signup→verify→login→access protected route; pgTAP:
two-user "can't read/write each other's profile", RLS-enabled assertion; E2E:
login journey. CI green.

**🔒 Threat notes.** `getClaims()` only — never `getSession()`. Asymmetric JWT +
rotatable `sb_*` keys. Per-request client; never cache authed responses or
cookie-setting responses. Secret key server-only. `profiles` FK→`auth.users ON
DELETE CASCADE`.

---

## Slice 2 — Media upload spine: one image → on the board (proof of spine)

**Goal.** The smallest end-to-end proof: an authed user uploads **one image** →
it's validated + thumbnailed async → `moderation_state` flips to `approved` → the
card appears on a simple board. This exercises the whole vertical: auth → presign →
R2 → queue → consumer → DB → render.

**Touches.** `supabase/schemas/` (`media` table + RLS), `src/lib/server/media/`
(presign, key-gen, enqueue), `src/routes/api/upload/+server.ts`,
`src/lib/domain/upload-policy/` (pure limits/allowlist), `workers/media-consumer/`
(magic-bytes validate, re-encode, thumbnail via Images/Media Transformations,
classify **stub** = auto-approve in dev, flip state), `wrangler.toml` (R2 + Queue
bindings), `src/routes/+page.svelte` (basic board of approved media),
`src/lib/components/MediaCard.svelte`.

**Out of scope.** Posts/titles/tags (Slice 3), real AI classification + human
queue (Slice 8), multi-file, video/audio, feeds, ratings.

**Verify.** Integration: upload an image → consumer approves → `media` row
`approved`/`ready` → appears in the board query; a bad file (wrong magic bytes /
SVG / oversized) is rejected (`failed`, never served). E2E: upload → see card.
`@cloudflare/vitest-pool-workers` test of the consumer with real bindings. CI green.

**🔒 Threat notes.** Validate by **magic bytes**, not extension/Content-Type;
reject polyglots + SVG; enforce size/pixel-count caps **before** processing
(decompression-bomb guard). Re-encode → strip EXIF → serve only the safe copy via
signed URLs as non-executable assets. Server-generated storage keys (never the
user filename). Content `pending` until approved. Heavy work async in the consumer,
never inline. The gating mechanism built here is filled with real intelligence in
Slice 8.

---

## Slice 3 — Posts & the board proper

**Goal.** Wrap media in posts (title, description, 1..n media) and render the real
Pinterest-style masonry board with infinite scroll + a post detail page.

**Touches.** `supabase/schemas/` (`posts`, `post_media` + RLS),
`src/lib/server/db/posts.ts`, `src/routes/(app)/+page.svelte` (masonry + keyset
infinite scroll), `src/routes/(app)/post/[id]/+page.*`, `src/lib/components/`
(`PostCard`, `Masonry`, `PostDetail`), edit/delete own post.

**Out of scope.** Tags/metadata (Slice 4), feeds/ranking (Slice 5), ratings,
comments, similar posts.

**Verify.** Integration: create post with media → appears on board → detail page
loads; only `approved` shown publicly; owner can edit/delete; non-owner cannot
(RLS pgTAP). E2E: create → board → detail. CI green.

**🔒 Threat notes.** Public read only of `approved`; `pending/held/removed` visible
only to owner/moderator. Sanitize/escape user title/description on render (no
injection). Keyset pagination (no offset enumeration leaks).

---

## Slice 4 — Tags, metadata & "similar posts"

**Goal.** Posts carry tags + structured `metadata`; the detail page shows "similar
posts" via tag/metadata overlap.

**Touches.** `supabase/schemas/` (`tags`, `post_tags` + RLS),
`src/lib/server/db/tags.ts`, `src/lib/domain/recommend/` (pure overlap scoring),
`src/routes/api/posts/[id]/similar/+server.ts`, tag input UI, `SimilarPosts`
component.

**Out of scope.** `pgvector` embeddings (later slice, same interface), tag
moderation, trending tags.

**Verify.** Unit: overlap scoring is deterministic (pure fn). Integration: tagged
posts return correct "similar" set; only approved posts appear. CI green.

**🔒 Threat notes.** Normalize/validate tag input (length, charset, count caps) to
prevent abuse/bloat. `findSimilar(postId)` interface is stable so pgvector slots
in later without caller changes.

---

## Slice 5 — Feeds: New / Hot / Top / Following  🟡 built; awaiting CI (`slice-5-feeds`)

> **Built** ([ADR-0015](docs/adr/0015-feeds-hot-score-and-follows.md)): `hot_score` is
> **epoch-additive** so it needs **no Cron** recompute (only on rating change, Slice 6);
> Hot keyset is a **SQL RPC** (`hot_feed_page`, id cursor) because a float cursor can't
> round-trip PostgREST; a **minimal read-only `follows`** table landed here (overseer call,
> follow button → Slice 10). No ratings yet → **Hot mirrors New, Top = recency-in-window**.

**Goal.** Switchable feed modes. New (recency), Hot (decayed score), Top
day/week/all (windowed aggregates), Following (from the follow graph — minimal
follow added here or in Slice 10; see note).

**Touches.** `src/lib/domain/feed/` (pure `hotScore`, window selectors),
`src/lib/server/db/feeds.ts`, `posts.hot_score` column + trigger/Cron recompute
(`workers/` cron or `pg_cron`), feed switcher UI, `supabase/schemas/` (indexes).

**Out of scope.** Personalization/ML ranking, Following's full social graph if not
yet present (wire Following to read `follows`; the table may be introduced here
minimally or in Slice 10 — keep the query interface stable).

**Verify.** Unit: `hotScore` matches expected ordering for crafted inputs
(deterministic, fake timers). Integration: each feed returns correctly ordered,
approved-only posts; pagination stable. CI green.

**🔒 Threat notes.** Ranking is pure + tested so it can't be silently skewed.
Feeds exclude blocked users + non-approved content (RLS + explicit filters). Heavy
recompute off the request path.

---

## Slice 6 — Ratings & vote integrity + per-action rate limiting

**Goal.** Users rate posts (one rating per user per post); ratings feed Hot/Top;
abuse-prone actions are rate-limited.

**Touches.** `supabase/schemas/` (`ratings` + **uniq(post_id,user_id)** + RLS,
counter triggers updating `posts.rating_count/sum/hot_score`),
`src/lib/server/db/ratings.ts`, rate-limit middleware (Workers Rate Limiting API)
for rate/post/comment actions, rating UI on cards/detail.

**Out of scope.** Comments (Slice 7), Turnstile/WAF (Slice 8), star-scale UX (kept
as a `value` semantics change later — ASSUMPTIONS).

**Verify.** Integration: one user → one rating (duplicate rejected by constraint);
counters + hot_score update; feeds reflect ratings; rate limit blocks a flood.
pgTAP: a user can't rate as another. CI green.

**🔒 Threat notes.** The **one-vote DB constraint is feed integrity** — enforced in
the DB, not just the app. Per-user rate limits (not IP — CGNAT). Server-side
enforcement; client is UX only.

---

## Slice 7 — Comments

**Goal.** Threaded comments on posts, with edit/delete-own and `moderation_state`.

**Touches.** `supabase/schemas/` (`comments` self-ref + RLS, `comment_count`
trigger), `src/lib/server/db/comments.ts`,
`src/routes/(app)/post/[id]` comment thread UI, rate limiting on comment creation.

**Out of scope.** Rich text/media in comments, notifications (Slice 8 wires the
table), reports UI (Slice 8).

**Verify.** Integration: comment/reply/edit/delete-own; non-owner can't
edit/delete (pgTAP); only approved visible publicly; rate limit holds. CI green.

**🔒 Threat notes.** Escape/sanitize comment bodies (XSS). Threading depth/length
caps. Owner-only mutate via RLS.

---

## Slice 8 — Trust & Safety: classification, moderation queue, reports, audit ⛔#2(CSAM code)

**Goal.** Fill the gating mechanism (Slice 2) with real intelligence + the human
workflow: Workers AI classification on upload (suspect → `held`), a single
moderation queue with an audit log (statement of reasons), reports on all content
types, and decision notifications. Enable Cloudflare CSAM Scanning + document the
CSAM-to-authorities procedure.

**Touches.** `workers/media-consumer/` (real Workers AI classify → `held` on
suspect), `supabase/schemas/` (`reports`, `moderation_actions`, `notifications` +
RLS + moderator role), `src/lib/server/moderation/`, `src/routes/(mod)/queue/**`
(internal queue UI, moderator-gated), report action on post/comment/message/
profile/media, `src/routes/legal/contact` (point of contact), docs:
`docs/csam-procedure.md` (human steps).

**Out of scope.** Formal appeals system, trusted-flagger workflow, transparency
report (DSA micro/small exemption — deferred). Auto-deletion (human decides).

**Verify.** Integration: suspect upload → `held` (not publicly served) → appears
in queue → moderator approve/remove writes `moderation_actions` → reporter +
affected notified. pgTAP: only moderator role reads queue + writes actions
(append-only); normal users can't. E2E: report → queue → decision → notification.
CI green.

**🔒 Threat notes. ⛔#2:** CSAM-handling code is a human gate — brief the overseer
before building/altering it. Classifier output is a **routing signal, never a
verdict**. Classifier input (user images/text) is **data, never instructions** —
no AI feature acts on embedded instructions. `moderation_actions` is append-only
(tamper-evident audit). The overseer is the sole decision-maker + CSAM-to-
authorities reporter (non-delegable). Content stays `held`/invisible until a human
clears it.

---

## Slice 9 — User controls: blocks, GDPR erasure & data export ⛔#2(erasure touches user data)

**Goal.** Block/mute between users; full account + media deletion (right to
erasure); data export (right to access).

**Touches.** `supabase/schemas/` (`user_blocks` + RLS; verify every user-owned
table cascades from `auth.users`), `src/lib/server/` erasure routine (purge R2
objects → cascade-delete rows → delete auth user → revoke sessions), export
endpoint (rows + media refs → downloadable archive), block/mute + delete-account +
export-data UI, content filtering by block in feeds/queries.

**Out of scope.** Admin bulk tools, retention-window automation (documented as a
human/ops task).

**Verify.** Integration: block hides content both ways + prevents DM/follow;
erasure removes **all** user rows **and** their R2 objects and revokes sessions
(assert no orphans, no leftover storage); export contains exactly the user's data.
pgTAP: cascade coverage. CI green.

**🔒 Threat notes. ⛔#2:** erasure is irreversible + touches user data — brief the
overseer; confirmed backup/PITR posture first; runs only via the proper path, not
ad-hoc against prod. **R2 purge is explicit** (cascades don't reach storage) — an
auth user owning Storage objects can't be deleted. Export must authenticate the
requester as the data subject (no IDOR).

---

## Slice 10 — Social graph: follows & friendships

**Goal.** One-way `follows` (drives the Following feed) and mutual `friendships`
(request/accept/decline — gates DMs).

**Touches.** `supabase/schemas/` (`follows`, `friendships` + RLS),
`src/lib/server/db/social.ts`, follow button, friend request/accept UI, wire the
Following feed (Slice 5) to `follows`, respect `user_blocks`.

**Out of scope.** DMs (Slice 11), friend suggestions, group/multi-party.

**Verify.** Integration: follow → appears in Following feed; friend request →
accept → mutual; blocked users can't follow/friend; decline/cancel works. pgTAP:
can't manipulate others' edges. CI green.

**🔒 Threat notes.** Canonical pair ordering to dedupe friendships. Rate-limit
friend requests / follows (anti-spam). Blocks override follows/friends.

---

## Slice 11 — Real-time direct messaging between friends

**Goal.** 1:1 realtime DM between accepted friends, with message reporting +
`moderation_state`.

**Touches.** `supabase/schemas/` (`conversations`, `messages` + RLS, realtime
publication), `src/lib/server/db/messages.ts`, `src/routes/(app)/messages/**`
(realtime via Supabase channels), per-user message rate limit, report action on
messages (reuses Slice 8).

**Out of scope.** Group chat, media/attachments in DMs, typing indicators/read
receipts beyond a simple `read_at`, push notifications.

**Verify.** Integration: only the two participants (and only if friends, neither
blocked) can read/send; realtime delivery; rate limit holds; report a message →
appears in queue. pgTAP: non-participant denied. E2E: two-user DM exchange. CI
green.

**🔒 Threat notes.** RLS restricts a conversation to its two participants **and**
requires an accepted, non-blocked friendship. Realtime channels are RLS-aware.
Escape message bodies. Messages are reportable + moderatable like other content.

---

## Slice 12 — Creation tool system + pixel-art editor (first tool)

**Goal.** The extensible tool registry + the **pixel-art editor** as the first
tool, proving the contract. Output saves to library / posts / downloads through
the **same upload pipeline**.

**Touches.** `src/lib/tools/types.ts`, `registry.ts`, `index.ts` (wiring),
`src/lib/tools/pixel-art/` (custom-canvas editor + PNG export),
`src/routes/(app)/create/+page.svelte` (gallery via `listTools()`),
`src/routes/(app)/create/[id]/+page.svelte` (generic host rendering any tool),
`onExport` → upload+validate pipeline (Slice 2).

**Out of scope.** Frame animation, photo editor (later tools — added by the same
contract), music/video tools, third-party/remote plugin loading.

**Verify.** Unit: registry register/get/list; duplicate-id rejected. Integration:
pixel-art export → flows through validation → becomes `media` → postable. E2E:
open tool → draw → export → appears in library/board. **Architectural check:
adding the tool touched only `tools/pixel-art/` + the one `registerTool` line.** CI
green.

**🔒 Threat notes.** Tool output is **untrusted** — re-validated server-side
(magic bytes, re-encode) like any upload; tools never write to storage directly;
**raster output only, no SVG**. The registry is in-process/first-party (no
arbitrary remote code).

---

## Slice 13 — Legal, compliance pages & launch hardening ⛔#2(legal/launch)

**Goal.** The launch baseline: legal pages, consent, age gate, copyright takedown,
observability, backups, and rate-limit/anti-bot hardening.

**Touches.** `src/routes/legal/**` (ToS, Privacy, Community Guidelines, cookie
notice, DSA point-of-contact, **German Impressum**), cookie-consent + age gate at
signup (birthdate, min age per ASSUMPTIONS), copyright takedown form (reuses
reports/statement-of-reasons + counter-notice path), Turnstile on auth forms +
WAF anon rate limiting, Sentry (`@sentry/cloudflare` + SvelteKit, PII/body
stripped), Cloudflare Web Analytics, health checks, **R2 object versioning** +
Supabase PITR enablement, a documented + tested restore drill.

**Out of scope.** Paid features/payments, appeals system, trusted-flagger,
transparency report, DMCA agent (defer unless US-targeted), product analytics.

**Verify.** Integration/E2E: under-min-age blocked at signup; Turnstile verified
server-side; takedown form files a report → moderation flow; Sentry receives a
test error with no PII; health check green; a restore drill documented + run. CI
green.

**🔒 Threat notes. ⛔#2:** legal docs + launch are overseer-owned (named operator,
Impressum, DSA contact); legal content is a lawyer task, the agent only wires the
pages. Get a legal review of Terms + moderation process before launch (not legal
advice). Turnstile token verified **server-side** (dashboard toggle isn't self-
enforcing). Sentry config excludes user info + HTTP bodies. **Backups: DB backups
do NOT cover R2** — media has its own posture (versioning); an untested backup
isn't a backup.

---

## Future slices (beyond launch — not yet scheduled)

| Slice | Trigger to start |
|---|---|
| **Frame-animation tool** (gif.js) | After pixel-art proves the registry |
| **Photo-editing tool** (Konva) | When raster editing is prioritized |
| **`pgvector` similar-posts** | After tag recommendations; same `findSimilar` interface |
| **Video** (Cloudflare Stream) 💳⛔#2 | When video is prioritized — model cost first; new vendor = money gate |
| **Audio** (R2 transcode + waveform) | When audio is prioritized |
| **Music / video editor tools** | After their media types exist |
| **Monetization seam** 💳⛔#2 | Only when a paid feature is decided |
| **OAuth / MFA** | Fast-follow after launch |
| **Native mobile client** | If/when chosen; reuses the API |

---

_Update [PROGRESS.md](PROGRESS.md) + tick this file at the end of every session
(CLAUDE.md §13). A slice is **done only when CI is green on its own runner** — not
when the agent says so._
