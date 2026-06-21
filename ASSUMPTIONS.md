# ASSUMPTIONS

> Per [CLAUDE.md](CLAUDE.md) routing rule (Autonomy guardrail #8): **product /
> cost / legal** assumptions are confirmed by the overseer or flagged for
> confirmation here; **purely technical** sub-choices are decided by the agent and
> recorded here (or in an [ADR](docs/adr/) when significant). An unanswered
> non-gate question proceeds on a conservative documented default, recorded here.
>
> Status legend: ✅ confirmed by overseer · 🔧 agent technical decision · ❓ default
> chosen, **needs overseer confirmation before the relevant slice ships**.

---

## Confirmed by the overseer (interview, 2026-06-21)

| # | Decision | Value |
|---|---|---|
| ✅ | Monthly budget | ~$25–50/mo (Supabase Pro + Cloudflare paid bits as needed) |
| ✅ | Platform reach | Responsive web, **desktop-first**; native app not planned (API kept clean to allow one later) |
| ✅ | First creation tool | **Pixel-art editor** |
| ✅ | Content policy | **SFW at launch**; data model leaves headroom for age-gated NSFW later (not built now) |
| ✅ | Monetization | **None now**; clean seam left, no payment code/vendor |
| ✅ | Moderation owner | **The overseer**, personally — sole DSA contact, Impressum operator, moderation decision-maker, CSAM-to-authorities reporter, prod-credential & merge-button holder |
| ✅ | Media processing | **Buy managed** (Cloudflare Images/Media Transformations; Stream later for video) |
| ✅ | EU data residency | **Pragmatic**: core personal data in EU Supabase (Frankfurt); media may be cached/processed globally via Cloudflare CDN (covered by Cloudflare DPA/SCCs) — to be confirmed with lawyer |

---

## Product / legal defaults — ❓ need overseer confirmation

| # | Assumption | Default chosen | Why / risk if wrong |
|---|---|---|---|
| ❓ | **Operating jurisdiction** | **Germany** (EU) | Brief mandates a *German* Impressum and the age-16 gate (GDPR Art. 8 as applied in DE). Drives legal-doc content + age threshold. Confirm before legal pages (Slice 13) ship. If another EU country, the age threshold (13–16) and Impressum format change. |
| ❓ | **Anonymous browsing** | Logged-out visitors **can view approved public content** (board, posts, comments, profiles); **all writes** (post, rate, comment, follow, friend, DM, report) require a **verified, age-gated account** | Standard for a Pinterest/Reddit-style board. Shapes RLS (public read of `approved` rows). If browsing must require login, RLS read policies tighten. |
| ❓ | **Minimum age** | **16** (Germany, GDPR Art. 8) | Age gate at signup stores birthdate; under-16 blocked. Confirm with jurisdiction. |
| ❓ | **"Following" vs "Friends" semantics** | **Two separate graphs**: `follows` (one-way, drives the *Following* feed, no approval) and `friendships` (mutual, approval required, **gates DMs**) | Matches "feeds like Reddit" + "DM between *friends*". If overseer wants a single mutual graph, the Following feed reads from friendships instead. |
| ❓ | **Rating model** | Single **like / upvote** (`value` smallint, default +1), **one per user per post** (DB unique constraint); feeds Hot/Top | Simplest integrity-friendly model. A 1–5 star scale is a later change to `value` semantics, not a schema rewrite. Confirm desired UX before Slice 6. |

---

## Technical decisions — 🔧 agent-decided (no overseer input needed)

| # | Decision | Rationale |
|---|---|---|
| 🔧 | **Auth methods at launch**: email/password **with email verification + password reset**. OAuth (Google) and MFA **deferred** behind a clean seam (Supabase supports both with config, no schema change) | Minimal secure baseline; OAuth needs provider app registration (overseer task) so it's a fast-follow, not launch-blocking |
| 🔧 | **Auth gate**: authorize only via `getClaims()` (or `getUser()` when a fresh record is needed) — **never `getSession()`** | Hard security rule; `getSession()` is unverified/spoofable |
| 🔧 | **Posts may hold multiple media** (carousel) via a `post_media` join table; media exists independently in the user's **library** and can be posted later or downloaded | Supports "save to library / post directly / download" from the brief |
| 🔧 | **Package manager**: pnpm; **Node 24 in CI** (pnpm 11.8 requires ≥22.13; engines floor `>=22.13`); TypeScript `strict`, `noUncheckedIndexedAccess` | Fast, strict, monorepo-friendly |
| 🔧 | **Svelte 5 (runes)**; `@sveltejs/adapter-cloudflare` | Current stable; Workers target |
| 🔧 | **Supabase region**: Frankfurt (`eu-central-1`); **R2** originals in EU jurisdiction where configurable | EU residency posture |
| 🔧 | **Queue consumer** is a **separate Cloudflare Worker** (not inline in the SvelteKit request worker) | Heavy/async media work off the request path |
| 🔧 | **Canonical safe formats**: images → re-encoded (e.g. WebP/AVIF variants + a safe original copy), EXIF stripped; **SVG uploads banned** | Security: neutralize payloads, strip PII, avoid SVG XSS/SSRF |
| 🔧 | **Default upload limits (initial, tunable)**: image ≤ 20 MB, ≤ 50 MP (decompression-bomb guard); per-user/action rate limits via Workers Rate Limiting API | Conservative starting caps; revisit against real usage |
| 🔧 | **Username**: unique, case-insensitive, `[a-z0-9_]`, 3–30 chars; changeable (with later cooldown if abused) | Simple, collision-safe |
| 🔧 | **IDs**: UUID (v4) primary keys generated DB-side; user-owned tables FK to `auth.users(id) ON DELETE CASCADE` | Erasure-by-cascade + no enumeration |
| 🔧 | **Time**: all timestamps `timestamptz`, stored UTC | Avoid TZ bugs |
| 🔧 | **Realtime transport**: Supabase Realtime (broadcast + Postgres changes), RLS-aware | No new vendor |

---

## Deferred (explicitly out of scope until a later trigger)

- Video (Cloudflare Stream) and audio transcode pipelines — until those media
  types reach the roadmap.
- Payments / Stripe — until a monetization feature is decided (a #2 gate).
- `pgvector` embedding recommendations — after tag/metadata recommendations ship.
- DSA formal appeals system, trusted-flagger workflow, annual transparency report
  — micro/small-enterprise exemption (DSA Art. 19); baseline still applies.
- Upload filters / staydown — Art. 17 light regime for new/small services.
- DMCA agent — only if/when targeting US users.
- OAuth providers, MFA — fast-follow after launch.
- Native mobile app — API kept clean to permit it later.

---

_Whenever an ❓ item is confirmed or changed, update this file and the affected
doc, and note it in [PROGRESS.md](PROGRESS.md)._
