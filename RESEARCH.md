# RESEARCH — Technology Choices for Clover

> **Purpose.** For each major area this records the realistic options, the
> recommendation, and the single constraint that drove the pick. The decisions
> here are turned into binding records in [docs/adr/](docs/adr/) and assembled
> into the system in [ARCHITECTURE.md](ARCHITECTURE.md).
>
> **How to read this.** Every section ends with **Decision** and **Driving
> constraint**. If you only read those two lines per section, you have the
> architecture's rationale.

The non-negotiable principles from the brief frame every choice: **readable
first**, **AI-decodable**, **simple/layered/expandable**, **secure by default**,
**media as references**. Where a "clever" option would beat a "boring" one only
marginally, the boring one wins — that is itself a constraint.

Confirmed product/cost decisions from the overseer interview live in
[ASSUMPTIONS.md](ASSUMPTIONS.md). The relevant ones here: **~$25–50/mo budget**,
**desktop-first responsive web**, **buy managed media processing**, **EU
database / global CDN**.

---

## 1. Language — TypeScript everywhere

| Option | For | Against |
|---|---|---|
| **TypeScript** | One language client+server; types are machine-readable contracts; huge ecosystem | Compile step; types can be evaded with `any` |
| JavaScript | No build friction | No type safety — fails "AI-decodable" |
| Rust/Go backend + TS frontend | Performance, safety | Two languages, two mental models — fails "readable by one person", more surface for a fresh AI session |

**Decision: TypeScript everywhere, `strict` mode on, `any` disallowed by lint.**
**Driving constraint:** AI-decodability — a single typed language means a fresh
session reads one set of contracts, and types document intent without prose.

---

## 2. App framework — SvelteKit

| Option | For | Against |
|---|---|---|
| **SvelteKit** | Least boilerplate; compiles away the framework so a file reads close to what it does; first-class load/form/endpoint primitives; small bundles; official Cloudflare adapter | Smaller ecosystem than React; fewer ready-made component libs |
| Next.js | Largest ecosystem; lots of hiring/answers | More abstraction (RSC, hydration model) between code and behavior — more to hold in a fresh session; heavier |
| Remix/React Router | Good data model | React boilerplate; less "least-code" than Svelte |
| SolidStart / Astro | Lean | Smaller communities; Astro is content-first, weaker for a heavily interactive app |

The brief's own reasoning holds up: for a solo, greenfield, must-stay-readable
project, the framework that puts the **least abstraction between source and
behavior** directly serves the top principle. The ecosystem gap is real but is
mitigated because most heavy lifting (DB, auth, realtime, media) is delegated to
Supabase/Cloudflare, not to framework plugins.

**Decision: SvelteKit (Svelte 5 runes), deployed on Cloudflare Workers via
`@sveltejs/adapter-cloudflare`.** Conservative fallback documented: if the
ecosystem gap ever bites (e.g. a needed primitive only exists for React),
Next.js is the escape hatch — but the UI/API/domain separation in
[ARCHITECTURE.md](ARCHITECTURE.md) keeps domain logic framework-free so a swap
touches only the `routes/` + `components/` layers.
**Driving constraint:** Readability — minimum abstraction between code and behavior.

---

## 3. Backend platform — Supabase (managed Postgres)

The backend must provide, at minimum: a relational database, authentication,
realtime subscriptions (for chat), and a vector store (for similar-posts). The
question is whether to assemble these or buy them pre-wired.

| Option | For | Against |
|---|---|---|
| **Supabase (managed)** | Postgres + Auth + Realtime + `pgvector` + Storage in one EU-hosted product; **Row-Level Security puts access control in auditable SQL**, so almost no permission plumbing is hand-written; local dev parity via `supabase start` | Vendor coupling; some features (PITR, branching) are paid tiers |
| Self-hosted Postgres + Auth.js + a realtime server + a vector DB | Maximum control | Four moving parts to run, secure, and back up — directly violates "simple" and explodes the solo operational burden |
| Firebase | Realtime + auth bundled | Document model fights the relational data here (feeds, joins, ranking); weaker for SQL-shaped access control; not EU-Postgres |
| PlanetScale / Neon + bolt-on auth/realtime | Great DB | Still have to assemble auth + realtime + vector separately |

RLS is the decisive factor: access control expressed **once, in the database, as
SQL** is reviewable by the separate reviewer agent and testable with pgTAP — it
turns the hardest-to-get-right part of a UGC platform (data isolation) into
something auditable rather than scattered across handlers.

**Decision: Supabase Cloud, EU region (Frankfurt / `eu-central-1`), Pro tier
before launch.** Auth via Supabase Auth; realtime via Supabase Realtime; vectors
via `pgvector`.
**Driving constraint:** Secure-by-default at solo scale — access control as
auditable SQL (RLS), not hand-written plumbing.

See also [ADR-0002](docs/adr/0002-supabase-backend.md),
[ADR-0008](docs/adr/0008-auth-supabase-getclaims.md).

---

## 4. Database & data modeling — Postgres (relational), media as references

| Option | For | Against |
|---|---|---|
| **Relational Postgres** | Feeds, ranking, joins, uniqueness constraints (one-vote), referential integrity, cascade-on-delete for GDPR erasure | Schema discipline required (we want that) |
| Document store | Flexible blobs | Loses the integrity guarantees the data model leans on |

**Media is never stored in the DB.** The database holds an object key + metadata;
bytes live in object storage (§5). This is a hard principle, not a tradeoff.

**Decision: Postgres via Supabase; declarative schema in `supabase/schemas/`,
migrations generated and committed; RLS on every table.**
**Driving constraint:** Integrity + auditable access control; media-as-references.

See [ADR-0011](docs/adr/0011-migrations-declarative.md).

---

## 5. Media storage & CDN — Cloudflare R2 + Cloudflare CDN

| Option | For | Against |
|---|---|---|
| **Cloudflare R2** | S3-compatible; **zero egress fees** (media bandwidth is not a cost driver); native to the same platform as the Worker/CDN; object versioning for backup | Newer than S3; fewer third-party integrations |
| AWS S3 + CloudFront | Mature | **Egress billed** — for a media-heavy board, bandwidth becomes the dominant cost; cross-vendor with the frontend |
| Supabase Storage | Already in-stack | Backed by S3 egress economics; we'd rather keep large-object bandwidth on the zero-egress provider |

Pairing R2 with Cloudflare's CDN and Workers means the frontend, the edge
validation, the media, and the cache are one platform with one bill and no
egress surprise. The DB stores only R2 keys + metadata.

**Decision: Cloudflare R2 for objects, behind Cloudflare's CDN; signed URLs;
object versioning on the prod bucket for media backup.** Originals kept in R2
(EU jurisdiction where configurable); managed transforms (§7) may cache globally
— acceptable per the overseer's "EU DB / global CDN" call.
**Driving constraint:** Cost — zero-egress is the reason media bandwidth isn't a
budget risk.

See [ADR-0003](docs/adr/0003-media-r2-cdn.md).

---

## 6. Realtime (chat & live updates) — Supabase Realtime

| Option | For | Against |
|---|---|---|
| **Supabase Realtime** | Already in-stack; Postgres-change + broadcast + presence channels; RLS-aware; no new vendor | Channel/auth model must be understood (designed in ARCHITECTURE) |
| Cloudflare Durable Objects (WebSocket) | Powerful, edge-native | We'd hand-build presence/fan-out/auth — more code, violates "simple" |
| Pusher/Ably (SaaS) | Turnkey | New vendor + cost for something we already have |

DM between friends is 1:1 and low-volume at launch; Supabase Realtime's broadcast
+ Postgres-changes model covers it without a new vendor.

**Decision: Supabase Realtime for DMs and live feed/notification updates.**
**Driving constraint:** Simplicity / no new vendor — reuse the in-stack realtime.

See [ADR-0006](docs/adr/0006-feeds-and-realtime.md).

---

## 7. Media processing pipeline — managed (Cloudflare), async via Queues

Overseer chose **buy managed**. Transcoding inline in a Worker is disallowed
(CPU/time limits, and a hostile file shouldn't run in the request path).

| Concern | Option chosen | Why |
|---|---|---|
| Image thumbnails/variants | **Cloudflare Images** or **Media Transformations** off R2 (`/cdn-cgi/media/`) | Managed resize/format; serve variants, never originals |
| Async orchestration | **Cloudflare Queues** + a consumer Worker | Heavy work off the request path; ret//retry + dead-letter |
| Safety scan | **Workers AI** image classification in the consumer | Runs before content is publicly served; output is a *routing signal*, never a verdict |
| Video (later) | **Cloudflare Stream** | Managed transcode + ABR + HLS/DASH + signed playback; only when video is on the roadmap |
| Audio (later) | R2 + transcode-on-ingest + waveform | No managed audio platform needed |

Validation (magic-bytes, size/dimension caps, re-encode to canonical safe format,
EXIF strip, SVG ban) is part of the **same** pipeline — see ARCHITECTURE
"Upload & processing pipeline". Originals are re-encoded; only the safe copy is
served.

**Decision: presigned R2 upload → Cloudflare Queues → consumer Worker (validate
+ transform + classify) → flip `moderation_state` to approved/held → store
playback refs.** Images day one; Stream/audio only when those media types reach
the roadmap.
**Driving constraint:** Security + cost — never transcode hostile input inline;
buy the managed transform instead of running ffmpeg ourselves.

See [ADR-0007](docs/adr/0007-media-pipeline.md).

---

## 8. Feed ranking — Postgres-computed, Reddit-style hot + windowed top

| Feed | Approach |
|---|---|
| **New** | `ORDER BY created_at DESC`, keyset pagination |
| **Hot** | Time-decayed score (Reddit "hot": `log10(score) + age/45000`-style) stored on the row, recomputed on rating change and/or by a periodic job |
| **Top day/week/all** | Aggregate ratings within a time window; indexed |
| **Following** | Posts from followed users (one-way follow graph), newest-first |

| Option | For | Against |
|---|---|---|
| **Compute in Postgres** | One source of truth; testable as pure SQL/functions; no extra infra | Ranking jobs need scheduling (pg_cron or a Cloudflare Cron Worker) |
| External ranking service / search engine | Scales huge | Premature for launch scale; new vendor; violates "simple" |

Ranking math lives in `src/lib/domain/feed/` as **pure functions** (unit-tested
in isolation) and is applied via SQL — so the algorithm is readable and testable
without a database.

**Decision: Postgres-backed feeds; hot-score as a stored, incrementally-updated
column; pure-function ranking logic in the domain layer; a scheduled job for
decay recompute.**
**Driving constraint:** Simplicity + testability — ranking as pure functions over
SQL, no extra service.

See [ADR-0006](docs/adr/0006-feeds-and-realtime.md).

---

## 9. Recommendations ("similar posts") — metadata/tags first, pgvector later

| Phase | Approach | Why |
|---|---|---|
| **Launch** | Tag + structured-metadata overlap scoring | Cheap, explainable, no ML; good enough for "similar posts" on a tagged board |
| **Later slice** | `pgvector` content embeddings (image/text) | Better semantic similarity; already available in Supabase, so no new vendor |

Starting with tags keeps the first recommendation feature a simple, debuggable
SQL query; embeddings slot in behind the same "similar posts" interface later
without a rewrite.

**Decision: tag/metadata overlap at launch; `pgvector` embeddings as a later
slice behind the same query interface.**
**Driving constraint:** Expandable simplicity — ship the explainable version,
leave a seam for embeddings.

See [ADR-0009](docs/adr/0009-recommendations-tags-then-vectors.md).

---

## 10. In-browser editing libraries — per-tool, behind one interface

The tools differ enough that one library does not fit all; the unifying force is
the **tool-registry interface** (§11), not a shared canvas lib.

| Tool | Library | Why |
|---|---|---|
| **Pixel art (first)** | **Lightweight custom `<canvas>`** | Pixel editing is a small, well-understood problem (grid, palette, draw, PNG export); a dependency adds weight without simplifying. Keeps the first tool tiny and the registry contract honest |
| Frame animation (later) | custom canvas + **gif.js** for export | GIF encoding is the only hard part; gif.js handles it |
| Raw-photo editing (later) | **Konva** (preferred) or Fabric.js | Layered raster manipulation benefits from a scene-graph lib; Konva is leaner/more maintained than Fabric for this |

Every tool exports a **raster/audio Blob** that flows through the **same upload
validation pipeline** as a normal upload — tools never write to storage directly
and their output is treated as untrusted (re-encoded server-side). No SVG output.

**Decision: pixel-art on a custom canvas first; gif.js for animation export;
Konva for photo editing — each behind the registry interface; all output
re-validated server-side.**
**Driving constraint:** Right-sized simplicity per tool + one security choke point
for all tool output.

See [ADR-0010](docs/adr/0010-editor-libraries.md).

---

## 11. The extensible tool system — one registry interface

This is the product's defining architectural requirement: **a new tool is added
by implementing one documented interface and registering it, with zero changes to
the core app.**

| Option | For | Against |
|---|---|---|
| **In-process registry + `CreationTool` interface** | Simplest thing that satisfies "no core changes"; tools are lazy-loaded modules; type-checked contract; trivially testable | Tools ship in the same bundle (fine — they're first-party for now) |
| Runtime/remote plugins (load arbitrary JS) | Third-party extensibility | Massive security surface (arbitrary code) for zero current benefit — we have no third-party tool authors |
| Microfrontend per tool | Independent deploys | Over-engineering for a solo app; violates "simple" |

The contract is written out in full in
[ARCHITECTURE.md](ARCHITECTURE.md#the-extensible-tool-system) and is the single
extension point. Adding a tool = a new folder implementing `CreationTool` + one
`registerTool(...)` line in the wiring file.

**Decision: a typed in-process `CreationTool` registry; tools are lazy-loaded
first-party modules; output re-validated by the shared pipeline.**
**Driving constraint:** "Add a tool without touching core" + no arbitrary-code
security surface.

See [ADR-0005](docs/adr/0005-tool-registry.md).

---

## 12. Repo shape — single repository ("monorepo")

| Option | For | Against |
|---|---|---|
| **Single repo, single SvelteKit app + `supabase/` + a consumer Worker** | A session sees the whole system at once (AI-decodable); one CI; one version history | Everything versions together (fine at this scale) |
| Multi-package monorepo (pnpm workspaces) | Enforced boundaries | Premature — adds tooling overhead before there's a second consumer of any package |
| Polyrepo | Independent lifecycles | A fresh session can't see the whole system — fails AI-decodability |

We keep **one repo** with strict *folder* boundaries (UI / API / domain /
storage) rather than splitting into packages now. If a real second consumer of a
package appears, promoting a folder to a workspace package is mechanical.

**Decision: one repository; one SvelteKit app + `supabase/` + a queue-consumer
Worker; boundaries enforced by folders + lint rules, not yet by packages.**
**Driving constraint:** AI-decodability — the whole system in one place.

See [ADR-0004](docs/adr/0004-monorepo-layout.md).

---

## 13. Hosting — two vendors, one job each

| Layer | Vendor | Job |
|---|---|---|
| Frontend + edge + media + CDN + queues + Workers AI | **Cloudflare** | Serve the app, validate/process/serve media, run async jobs |
| Database + auth + realtime + vectors | **Supabase (EU)** | All relational data, identity, live subscriptions, similarity |

Each vendor does one **separable, swappable** job. No self-hosting. Free tiers
for dev; Supabase Pro before launch (free projects pause after a week idle).

**Decision: Cloudflare (Workers/R2/CDN/Queues/Images/Workers AI) + Supabase Cloud
(EU). No self-hosting.**
**Driving constraint:** Operational simplicity for a solo operator — two managed
vendors, clean seam between them.

See [ADR-0001](docs/adr/0001-sveltekit-frontend.md),
[ADR-0002](docs/adr/0002-supabase-backend.md).

---

## 14. Supporting choices (decided, recorded briefly)

| Area | Choice | Constraint |
|---|---|---|
| Package manager | **pnpm** | Fast, disk-efficient, strict; good monorepo path later |
| Testing | **Vitest** (unit/integration) · **Playwright** (E2E) · **pgTAP** (RLS) · `@cloudflare/vitest-pool-workers` | Native, no new vendor; real DB/RLS, not mocks |
| Error tracking | **Sentry** (`@sentry/cloudflare` + SvelteKit SDK), PII-stripped | Boring, free dev tier |
| Analytics | **Cloudflare Web Analytics** (cookieless) | No consent burden at launch |
| Bot defense | **Cloudflare Turnstile** (server-verified) + email verification | Native, privacy-respecting |
| Rate limiting | **Workers Rate Limiting API** (per-user/action) + WAF (anon/flood) | Native; per-user preferred over IP (CGNAT) |
| CI/CD | **GitHub Actions** (gate) + **Cloudflare Workers Builds** (deploy) | One deploy path; CI is the authority on "done" |
| Secrets | `wrangler secret` / `.dev.vars` / SvelteKit `$env/*/private` + gitleaks | No secret in repo, ever |

---

## What we are deliberately NOT choosing (and when to revisit)

- **No video/audio infrastructure yet** (Stream/audio transcode) — only when those
  media types reach the roadmap. Cost multiplies with renditions.
- **No payments / Stripe** — overseer chose no monetization now; a clean seam is
  left (see ARCHITECTURE), revisit when a paid feature is decided (a #2 gate).
- **No third-party/remote plugin loading** — security surface with no current
  benefit; revisit only if external tool authors become a goal.
- **No upload filters / staydown** — under EU Art. 17 a new, small service uses
  best-efforts + notice-and-takedown; revisit at the >3yr / >€10M thresholds.
- **No product analytics (PostHog) / appeals system / trusted-flagger workflow** —
  deferred (DSA micro/small-enterprise exemption); the DSA baseline still applies.
- **No native mobile app** — responsive web first; API kept clean so a native
  client *could* reuse it later.

---

_See [ARCHITECTURE.md](ARCHITECTURE.md) for how these assemble, and
[ROADMAP.md](ROADMAP.md) for the order they get built in._
