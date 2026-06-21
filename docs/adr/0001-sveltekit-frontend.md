# ADR-0001 — SvelteKit on Cloudflare Workers as the app framework

**Status:** Accepted
**Date:** 2026-06-21

## Context
This is a solo, greenfield, AI-built project whose top principle is readability —
a single file must be understandable on its own and a fresh AI session must be able
to safely make large changes. The dominant constraint is **minimum abstraction
between source and behavior**. We also need it to run on Cloudflare (where media,
edge validation, and the CDN live) so the frontend and edge are one platform.

## Decision
Use **SvelteKit (Svelte 5 runes)**, deployed to **Cloudflare Workers** via
`@sveltejs/adapter-cloudflare`. Keep domain logic framework-free (ARCHITECTURE §2)
so the framework is replaceable.

## Consequences
- Least boilerplate; compiled output reads close to the source; small bundles.
- First-class `load`/form-action/endpoint primitives map cleanly to our UI/API split.
- Smaller component ecosystem than React — acceptable because heavy lifting is
  delegated to Supabase/Cloudflare, not framework plugins.
- Per-request Supabase client + no-cache-for-authed-routes must be enforced on Workers.

## Alternatives
- **Next.js** — largest ecosystem but more abstraction (RSC/hydration) to hold in a
  fresh session; kept as the documented escape hatch if the ecosystem gap ever bites.
- **Remix / SolidStart / Astro** — either more boilerplate or weaker fit for a
  heavily interactive app.
