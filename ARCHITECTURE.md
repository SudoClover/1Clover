# ARCHITECTURE — Clover

> **Clover** is a creative imageboard: a Pinterest-style masonry board crossed
> with Reddit-style feeds, with built-in in-browser creation tools, on a public
> UGC platform operated from the EU.
>
> **This document is the living source of truth for the *shape* of the system.**
> It is written so a competent non-programmer can follow the data flow and any
> developer (or fresh AI session) can understand one part without reading
> everything. Decisions are justified in [RESEARCH.md](RESEARCH.md) and recorded
> in [docs/adr/](docs/adr/). Conventions for *writing* the code are in
> [CLAUDE.md](CLAUDE.md). The build order is in [ROADMAP.md](ROADMAP.md).
>
> **Keep this in sync with the code** — see the doc-sync rule in CLAUDE.md.

---

## 1. The big picture

Two managed vendors, each doing one swappable job:

- **Cloudflare** serves the app (SvelteKit on Workers), validates/processes/serves
  all media (R2 + CDN + Queues + Workers AI + Images), and runs scheduled jobs.
- **Supabase (EU/Frankfurt)** holds all relational data, identity (Auth),
  realtime subscriptions, and vector similarity — with **access control as
  Row-Level Security (RLS) SQL in the database**.

```
                            ┌──────────────────────── Browser (SvelteKit app) ───────────────────────┐
                            │  UI components · creation tools (registry) · per-request Supabase client │
                            └───────────────┬───────────────────────────────────────┬─────────────────┘
                                            │  HTTPS                                  │  WSS (realtime)
                                            ▼                                        ▼
        ┌──────────────────── Cloudflare ───────────────────────┐      ┌──────────── Supabase (EU) ───────────┐
        │  SvelteKit Worker (SSR + /api endpoints)               │      │  Postgres + RLS (source of truth)     │
        │   • auth gate via getClaims()                          │◄────►│  Auth (PKCE, asymmetric JWT)          │
        │   • reads/writes Postgres via @supabase/ssr           │ SQL  │  Realtime (broadcast + pg changes)    │
        │   • issues presigned R2 upload URLs                    │      │  pgvector (similar posts, later)       │
        │   • enqueues media jobs                                │      └───────────────────────────────────────┘
        │                                                        │
        │  R2 (objects)   CDN/Images (variants)   Queues ──► Consumer Worker
        │   originals      thumbnails/transcodes            • validate (magic bytes, caps, re-encode, EXIF strip)
        │   + versioning   served via signed URLs           • Workers AI safety classification (routing signal)
        │                                                    • flip moderation_state pending→approved|held
        │  Cron Worker (feed decay, cleanups)  ·  Turnstile  ·  CSAM Scanning Tool (media zone)
        └────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                              Sentry (errors, PII-stripped) · Cloudflare Web Analytics
```

**Data never crosses a layer it shouldn't:** the browser never holds a
service-role secret; raw media never enters Postgres; the request Worker never
transcodes; user content is never executed as instructions (see §9).

---

## 2. Layered separation of concerns

The hard rule (principle: *simple, layered, expandable*): each layer may call the
layer below it, never the reverse, and never skip the domain layer for business
rules.

| Layer | Lives in | Responsibility | May depend on |
|---|---|---|---|
| **UI** | `src/routes/**/+page.svelte`, `src/lib/components/**` | Render, capture input, client UX-only validation | Domain types, API endpoints |
| **API / transport** | `src/routes/**/+page.server.ts`, `+server.ts`, `hooks.server.ts` | Auth gate (`getClaims`), input validation, call domain, shape responses | Domain, server services |
| **Domain (pure)** | `src/lib/domain/**` | Business rules: ranking, recommendation scoring, validation policy, tool contracts. **No framework, no I/O** | Types only |
| **Server services** | `src/lib/server/**` | I/O: DB access, auth helpers, R2/presign, queue enqueue, moderation actions | Domain, Supabase, R2 |
| **Storage** | Supabase Postgres (+RLS), Cloudflare R2 | Persist data + objects | — |

> The **domain layer is pure and framework-free** so its logic (feed ranking,
> recommendation scoring, upload-policy decisions) is unit-tested without a
> database or a browser, and a fresh AI session can read a rule in one file. This
> is also what keeps the SvelteKit→Next.js escape hatch cheap.

---

## 3. Repository layout (single repo)

See [ADR-0004](docs/adr/0004-monorepo-layout.md). One repo; boundaries enforced by
folders + lint rules.

```
/
├─ .github/workflows/        # CI gates + DB-migrate-on-merge
├─ docs/
│  └─ adr/                   # Architecture Decision Records (one per significant choice)
├─ supabase/
│  ├─ schemas/               # DECLARATIVE schema — source of truth (tables, RLS, functions)
│  ├─ migrations/            # generated by `supabase db diff`, committed, never hand-applied to prod
│  ├─ tests/                 # pgTAP RLS tests (negative + "RLS enabled on every table")
│  └─ functions/             # Supabase Edge Functions (only if needed)
├─ src/
│  ├─ lib/
│  │  ├─ server/             # SERVER-ONLY (never shipped to client)
│  │  │  ├─ supabase.ts      #   per-request client factory (never module-scope)
│  │  │  ├─ auth/            #   getClaims helpers, route guards
│  │  │  ├─ db/              #   typed data-access functions (one file per aggregate)
│  │  │  ├─ media/           #   presign, enqueue, key generation
│  │  │  └─ moderation/      #   moderation actions, audit writes, notifications
│  │  ├─ domain/             # PURE logic (no I/O): feed/, recommend/, upload-policy/, tools contracts
│  │  ├─ tools/              # creation tools + the registry
│  │  │  ├─ registry.ts      #   registerTool / getTool / listTools
│  │  │  ├─ index.ts         #   THE ONE WIRING FILE (registerTool calls)
│  │  │  ├─ types.ts         #   CreationTool / ToolContext / ToolExport contracts
│  │  │  └─ pixel-art/       #   first tool (own folder)
│  │  ├─ components/         # shared Svelte UI
│  │  └─ types/              # generated Supabase types + shared TS types
│  └─ routes/                # SvelteKit routes (pages + /api endpoints + hooks)
├─ workers/
│  └─ media-consumer/        # Cloudflare Queue consumer Worker (validate/transform/classify)
├─ e2e/                      # Playwright (separate suite)
├─ ARCHITECTURE.md  CLAUDE.md  ROADMAP.md  PROGRESS.md  RESEARCH.md  ASSUMPTIONS.md  README.md
└─ package.json  wrangler.toml  vite/svelte configs  .env.example
```

---

## 4. Data model

Postgres, EU region. **Every user-owned table** FKs to `auth.users(id) ON DELETE
CASCADE` (GDPR erasure by cascade — R2 objects purged separately, see §8).
**Every table has RLS enabled** with explicit policies; default-deny.

Enums shared across content tables:

```
moderation_state : pending | approved | held | removed
processing_state : pending | processing | ready | failed
media_kind       : image | audio | video
report_target    : post | comment | message | profile | media
report_status    : open | actioned | dismissed
mod_action       : approve | hold | remove | restore | warn | reinstate
friend_status    : pending | accepted | declined | blocked
```

### 4.1 Entity overview

```
auth.users (Supabase)
   │ 1:1 (signup trigger)
   ▼
profiles ──< posts ──< post_media >── media          posts ──< comments (self-ref thread)
   │           │                        ▲ owner        │
   │           │ 1:n                     │              └─< ratings (unique: post+user)
   │           └─< post_tags >── tags    │
   │                                     │
   ├─< follows (follower→followee)       │
   ├─< friendships (requester↔addressee) │
   ├─< user_blocks (blocker→blocked)     │
   ├─< conversations (1:1) ──< messages  │
   ├─< notifications                     │
   └────────────── reports / moderation_actions ──────┘  (polymorphic by target_type)
```

### 4.2 Tables (key columns; full DDL lives in `supabase/schemas/`)

**Identity & social**

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id PK→auth.users`, `username uniq`, `display_name`, `bio`, `avatar_media_id`, `birthdate`, `created_at` | Created by a signup trigger from `auth.users`. `birthdate` powers the age gate. Public read of non-sensitive cols; self-write. |
| `follows` | `follower_id`, `followee_id`, `created_at`, PK(follower,followee) | One-way; drives the **Following** feed. No approval. |
| `friendships` | `requester_id`, `addressee_id`, `status friend_status`, `created_at`, `responded_at`, uniq(pair) | Mutual once `accepted`; **gates DMs**. Canonical pair ordering to dedupe. |
| `user_blocks` | `blocker_id`, `blocked_id`, `created_at`, uniq(pair) | Hides content both ways; blocks DM/follow/friend. |

**Content**

| Table | Key columns | Notes |
|---|---|---|
| `media` | `id PK`, `owner_id→auth.users`, `storage_key`, `kind media_kind`, `mime_type`, `byte_size`, `width`, `height`, `duration_ms`, `checksum`, `variants jsonb` (thumbnail/derived keys), `processing_state`, `moderation_state`, `created_at` | The user's **library**. `storage_key` is server-generated; original re-encoded; only safe copy served. Bytes live in R2, never here. |
| `posts` | `id PK`, `author_id→auth.users`, `title`, `description`, `metadata jsonb`, `moderation_state`, `rating_count`, `rating_sum`, `comment_count`, `hot_score`, `created_at`, `edited_at` | Counters/`hot_score` are denormalized caches updated by triggers/jobs for feed performance. `metadata` = structured discovery fields. **Slice 3 builds** `id/author_id/title/description/moderation_state/created_at/edited_at` only. **Slice 4 adds tags but deliberately NO `metadata` column** (overseer decision — similarity is tag-overlap only; [ADR-0014](docs/adr/0014-tags-and-similar-posts.md)); `metadata`/counters/`hot_score` remain additive later (counters/`hot_score` Slices 5–6, `metadata` if a concrete need appears). `moderation_state` defaults `approved` (post text moderated reactively — reports/queue, Slice 8); created atomically with its `post_media` via the `create_post` RPC ([ADR-0013](docs/adr/0013-client-writable-posts-atomic-create.md)). First **client-writable** table. |
| `post_media` | `post_id`, `media_id`, `position`, PK(post,media) | A post references 1..n library media (carousel); media reusable. Owner-only link/reorder/unlink via RLS; `edited_at` server-stamped by trigger. |
| `tags` | `id PK`, `name uniq` (normalized, `CHECK ~ ^[a-z0-9-]{1,30}$`), `created_at` | Discovery primitive (**Slice 4**). Global/shared — that sharing is what powers tag overlap. Public read; any signed-in user may introduce a tag; clients never update/delete (service_role/moderator only). |
| `post_tags` | `post_id`, `tag_id`, PK(post,tag) | Many-to-many; drives tag-overlap "similar posts" (**Slice 4**). Owner-only link/unlink via RLS; a post's tags are replaced atomically by the `set_post_tags` RPC (SECURITY INVOKER, get-or-create + relink). [ADR-0014](docs/adr/0014-tags-and-similar-posts.md). |
| `comments` | `id PK`, `post_id→posts`, `author_id→auth.users`, `parent_comment_id` (self-ref, nullable), `body`, `moderation_state`, `created_at`, `edited_at` | Threaded. |
| `ratings` | `id PK`, `post_id→posts`, `user_id→auth.users`, `value smallint`, `created_at`, **uniq(post_id,user_id)** | One per user per post — **feed integrity** constraint. |

**Messaging**

| Table | Key columns | Notes |
|---|---|---|
| `conversations` | `id PK`, `user_a`, `user_b` (canonical order, uniq pair), `last_message_at` | 1:1 only; exists only between accepted friends. |
| `messages` | `id PK`, `conversation_id→conversations`, `sender_id→auth.users`, `body`, `moderation_state`, `read_at`, `created_at` | Realtime via Supabase channels; reportable. |

**Trust & Safety / compliance**

| Table | Key columns | Notes |
|---|---|---|
| `reports` | `id PK`, `reporter_id→auth.users`, `target_type report_target`, `target_id`, `reason`, `details`, `status report_status`, `created_at`, `resolved_by`, `resolved_at` | Every post/comment/message/profile/media is reportable. Polymorphic target. |
| `moderation_actions` | `id PK`, `moderator_id→auth.users`, `target_type`, `target_id`, `action mod_action`, `reason`, `report_id` (nullable), `created_at` | **Audit log + DSA "statement of reasons"** — who/what/when/why. Append-only. |
| `notifications` | `id PK`, `user_id→auth.users`, `type`, `payload jsonb`, `read_at`, `created_at` | Auto-notify reporter + affected user on each decision; social notifications. |

> **Copyright takedowns & counter-notices reuse this same infrastructure**: a
> takedown is a `report` (with a copyright reason capturing rightsholder identity,
> the work, the URL, a good-faith statement); removal + uploader notification +
> counter-notice flow run through `moderation_actions` + `notifications`. No
> separate tables. (DSA + Art. 17 light regime — see CLAUDE.md legal section.)

> **NSFW headroom (not built now):** an age-gated `is_nsfw boolean` could be added
> to `posts`/`media` later without a rewrite; until then the NSFW classifier
> signal routes to *removal*, not gating. (Overseer: SFW-now.)

### 4.3 Access-control posture (RLS, summarized)

- **Public read** of `approved`, non-removed content (posts, post_media→media,
  comments, tags, public profile fields) — supports logged-out browsing
  (ASSUMPTIONS ❓). Everything else is default-deny.
- **Owner-write** on own rows only (`auth.uid() = owner/author/user_id`).
- **`pending`/`held`/`removed`** content is visible only to its owner and to
  moderators.
- **Messages/conversations**: readable only by the two participants, and only
  between accepted friends, neither having blocked the other.
- **`user_blocks`** filters content visibility both directions.
- **Moderator role** (the overseer) can read all states and write
  `moderation_actions`; enforced via a custom claim / role, checked in RLS.
- **`reports`**: insert by any authed user; read own + moderator; `moderation_actions`
  insert by moderator only, **append-only** (no update/delete).

Every table's policies are proven by **pgTAP negative tests** (the two-user
"can't see each other's data" test) plus an assertion that **RLS is enabled on
every table** — see [CLAUDE.md](CLAUDE.md) testing rules.

---

## 5. Upload & processing pipeline

The **same pipeline** enforces Trust & Safety, validation, and processing.
Nothing is served until it passes. (See [ADR-0007](docs/adr/0007-media-pipeline.md).)

```
1. Client requests an upload slot
   → SvelteKit /api endpoint: auth gate (getClaims), per-user rate-limit check,
     declared kind/size sanity → returns a PRESIGNED R2 PUT url + server-generated key,
     and inserts a `media` row (processing_state=pending, moderation_state=pending).

2. Client PUTs the bytes straight to R2 (client-side checks are UX only).

3. Endpoint ENQUEUES a job on Cloudflare Queues (media key + media id).

4. Consumer Worker (workers/media-consumer) processes ASYNC:
   a. VALIDATE: read magic bytes → strict allowlist (image/audio/video);
      reject extension/Content-Type mismatch and polyglots; enforce size,
      dimensions/pixel-count (decompression-bomb guard), duration caps; SVG banned.
   b. RE-ENCODE/TRANSCODE to a canonical safe format (strips EXIF/metadata,
      neutralizes embedded payloads); generate thumbnail/variants. Store the SAFE
      copy in R2; never serve the original bytes.
   c. SAFETY SCAN: Workers AI image classification — a ROUTING SIGNAL, never a verdict.
   d. RESULT:
        ok + clean  → moderation_state = approved, processing_state = ready, store variant refs
        ok + suspect→ moderation_state = held    (enters human moderation queue)
        invalid     → processing_state = failed   (not served; surfaced to uploader)

5. UI shows "processing…" until ready; the card appears on the board only when approved.

Cloudflare CSAM Scanning Tool runs on the media zone independently (known-CSAM).
```

**Key properties:** heavy work is off the request path; the original is never
served; content is `pending` (invisible) until it passes; classifier output only
*routes* to a human, it does not auto-publish or auto-condemn.

**Creation-tool output uses this exact pipeline** — a tool's exported Blob is
uploaded and re-validated server-side like any other upload (§7). Tools never
write to storage directly.

> **Slice 2 build status (the spine).** The pipeline skeleton is built and proven
> end-to-end locally + in CI: `POST /api/upload` (auth-gated) → object store →
> `media` row (`pending`) → dispatch → the dependency-injected `runMediaPipeline`
> (`src/lib/server/media/`) → magic-byte validation, re-encode + thumbnail, stub
> classify → `approved`/`ready`, rendered on the board (`/`) via `/media/[...key]`.
> The paid/native pieces are **deferred to the deploy gate** behind seams: presigned
> R2 PUT, **Cloudflare Images** (re-encode; sharp stands in for Node dev/CI),
> **Workers AI** (classify; stubbed), and the real R2 bucket + Queue. See
> [ADR-0012](docs/adr/0012-slice2-media-spine-buildtest.md).

---

## 6. Feeds, ranking & recommendations

(See [ADR-0006](docs/adr/0006-feeds-and-realtime.md),
[ADR-0009](docs/adr/0009-recommendations-tags-then-vectors.md).)

| Feed | Source |
|---|---|
| **New** | `posts` where `approved`, `ORDER BY created_at DESC`, keyset pagination |
| **Hot** | `hot_score DESC` — time-decayed score stored on `posts`, recomputed on rating change + by the Cron Worker |
| **Top** day/week/all | rating aggregates within a time window, indexed |
| **Following** | posts by users the viewer `follows`, newest-first |

- **Ranking math is pure** in `src/lib/domain/feed/` (e.g. `hotScore(score, ageSeconds)`),
  unit-tested without a DB; SQL applies it.
- **"Similar posts"** (post detail page): launch = tag + `metadata` overlap score
  in `src/lib/domain/recommend/`; later = `pgvector` embeddings behind the same
  `findSimilar(postId)` interface — no caller changes.
- **Blocks/holds** are filtered out in every feed query via RLS + explicit filters.

> **Slice 3 build status (posts & the board).** The board (`/`) and post detail
> (`/post/[id]`) are built: the **New** view above is realized as approved posts
> newest-first with **keyset** infinite scroll (cursor on `(created_at, id)` over the
> partial `approved` index; next pages via `/api/board`). Each card's cover is the
> lowest-`position` approved+ready media's thumbnail. Data access is
> `src/lib/server/db/posts.ts` (the **authed per-request client** + RLS, not
> service-role); create goes through the atomic **`create_post`** RPC
> ([ADR-0013](docs/adr/0013-client-writable-posts-atomic-create.md)); owner edit/delete
> are single-statement writes gated by RLS. New components: `PostCard`, `Masonry`,
> `PostDetail`. Hot/Top/Following + the `hot_score` column and ranking math remain
> Slice 5.

---

## 7. The extensible tool system

> The product's defining requirement: **add a tool by implementing one interface
> and registering it — zero core changes.** (See [ADR-0005](docs/adr/0005-tool-registry.md).)
> This is the single, documented extension point.

### 7.1 The contract (`src/lib/tools/types.ts`)

```ts
import type { Component } from 'svelte';

export type MediaKind = 'image' | 'audio' | 'video';

/** A reference to existing media a tool may open for editing. */
export interface MediaRef {
  id: string;
  kind: MediaKind;
  /** Signed, time-limited URL to the safe (re-encoded) asset. */
  url: string;
}

/** What a tool produces when the user saves/exports. Always raster/audio bytes —
 *  re-validated server-side by the same upload pipeline (no SVG, no trust). */
export interface ToolExport {
  blob: Blob;                       // the produced bytes
  kind: MediaKind;                  // declared kind (server re-checks magic bytes)
  mimeType: string;                 // e.g. "image/png"
  /** Suggested, untrusted metadata (dimensions, source params, tool id). */
  meta?: Record<string, unknown>;
}

/** Injected into a tool's editor component by the host shell. */
export interface ToolContext {
  /** Optional media to open (e.g. "edit this photo"); undefined = blank canvas. */
  initialMedia?: MediaRef;
  /** Tool calls this on save/export → host runs the upload+validation pipeline. */
  onExport: (result: ToolExport) => Promise<void>;
  /** Host-provided, throttled status line for the editor (no direct DOM access). */
  reportStatus?: (message: string) => void;
}

/** THE interface every creation tool implements. Adding a tool = implement this
 *  in its own folder + one registerTool() call. Nothing in core changes. */
export interface CreationTool {
  /** Stable unique id; used in URLs (/create/[id]) and as the registry key. */
  readonly id: string;             // e.g. "pixel-art"
  readonly name: string;           // shown in the tool gallery
  readonly description: string;
  readonly icon: string;           // asset path or icon name
  /** Media kind(s) this tool can output (for filtering/eligibility). */
  readonly outputKinds: readonly MediaKind[];
  /** Lazy-loaded editor component — keeps tools out of the core bundle. */
  readonly load: () => Promise<{ default: Component<{ ctx: ToolContext }> }>;
}
```

### 7.2 The registry (`src/lib/tools/registry.ts`)

```ts
import type { CreationTool } from './types';

const registry = new Map<string, CreationTool>();

export function registerTool(tool: CreationTool): void {
  if (registry.has(tool.id)) throw new Error(`Duplicate tool id: ${tool.id}`);
  registry.set(tool.id, tool);
}
export function getTool(id: string): CreationTool | undefined {
  return registry.get(id);
}
export function listTools(): CreationTool[] {
  return [...registry.values()];
}
```

### 7.3 Wiring — the ONE file that knows about specific tools (`src/lib/tools/index.ts`)

```ts
import { registerTool } from './registry';
import { pixelArtTool } from './pixel-art';
// New tools are added here — and ONLY here.
registerTool(pixelArtTool);
// registerTool(frameAnimationTool);   // later
// registerTool(photoEditorTool);      // later
```

### 7.4 How a tool plugs in (no core changes)

1. Create `src/lib/tools/<your-tool>/` with an `index.ts` exporting a
   `CreationTool` and a Svelte editor component taking `{ ctx: ToolContext }`.
2. On save, call `ctx.onExport({ blob, kind, mimeType, meta })`.
3. Add one `registerTool(yourTool)` line to `src/lib/tools/index.ts`.

The host shell (`/create` gallery, `/create/[id]` editor route) renders any
registered tool generically via `listTools()` / `getTool(id)`. The export always
flows through the **server-side upload+validation pipeline** (§5) — so a tool
cannot bypass safety, and tool output is untrusted like any upload.

**Out of scope (deliberately):** runtime/remote loading of third-party tool code
(arbitrary-code security surface, no current need) — see RESEARCH §11.

---

## 8. Cross-cutting designs (built in from day one)

| Concern | Design | Detail |
|---|---|---|
| **Auth** | Supabase Auth, `@supabase/ssr` (cookie, PKCE); gate every protected route via `getClaims()`; per-request client (never module scope); never cache authed responses | [ADR-0008](docs/adr/0008-auth-supabase-getclaims.md) |
| **GDPR erasure** | Server routine: purge R2 objects → cascade-delete user rows → delete auth user → revoke sessions. **R2 purge is explicit** (cascades don't reach storage) | Slice 9 |
| **GDPR access** | Server endpoint exports a user's rows + media refs as a downloadable archive | Slice 9 |
| **Trust & Safety** | `moderation_state` gating in the pipeline (§5); single moderation queue + audit log (`moderation_actions` = statement of reasons); reports on everything; reporter+affected notified; Cloudflare CSAM tool; documented human CSAM-to-authorities procedure | Slice 8 |
| **Rate limiting** | Turnstile (server-verified) on auth forms; Workers Rate Limiting API per-user/action (upload/post/comment/message/rate); WAF for anon flood; one-vote DB constraint | Slice 6, 8 |
| **Secrets** | Classified (publishable/`PUBLIC_` = client-safe; secret key / R2 creds / CF tokens = server-only); platform secret stores only; `.env.example` placeholders; gitleaks + GitHub push protection; rotatable `sb_publishable_`/`sb_secret_` keys | CLAUDE.md |
| **Observability** | Sentry (`@sentry/cloudflare` + SvelteKit SDK), PII/body stripped; Cloudflare Workers Observability; cookieless Web Analytics; health check | Slice 13 |
| **Backups** | Supabase Pro daily + PITR (prod); **R2 object versioning** (DB backups do NOT cover media); periodic restore test | Slice 13 |
| **Monetization seam** | No payment code now; a future `entitlements`/billing module would sit in `src/lib/server/` behind a domain interface — isolated, additive | Deferred (#2 gate) |

---

## 9. Security invariants (must always hold)

These are properties the reviewer agent and CI verify on every slice:

1. **All user/web content is untrusted data, never instructions.** No agent tool
   or AI feature (classification, moderation) acts on instructions embedded in
   uploads, user text, or fetched pages. Data and instructions stay separate.
2. **Authorize via `getClaims()`/`getUser()`, never `getSession()`.**
3. **RLS enabled on every table; default-deny; proven by negative tests.**
4. **The Supabase secret key bypasses RLS — server-only; its exposure = full
   breach.** Never in a client bundle, log, or doc.
5. **Only re-encoded media is served**, from R2 via signed URLs, as
   non-executable static assets. Originals and SVG are never served.
6. **Content is `pending` (invisible) until the pipeline approves it.**
7. **No raw media in Postgres.** DB stores keys + metadata only.
8. **Migrations only via CI to prod**; the implementing agent never holds prod
   credentials (Autonomy guardrail #1).

---

## 10. Environments & deploy flow

| Env | DB | Frontend | Secrets |
|---|---|---|---|
| **Local** | `supabase start` (full schema/auth/RLS) | `vite dev` / `wrangler dev` | `.dev.vars` (git-ignored) |
| **Prod** | Supabase Cloud (EU), separate project | Cloudflare Workers Builds (auto-deploy `main`) | CF/Supabase secret stores only |

Migrations reach prod **only** via GitHub Actions on merge to `main` — never
`db push` from a laptop, never Dashboard edits (drift). Non-prod branches get
preview URLs. One deploy path only. See [CLAUDE.md](CLAUDE.md) git/CI section.

---

_Change this doc whenever the shape changes; add an ADR for any significant
decision; the periodic drift audit (CLAUDE.md) checks code against this file._
