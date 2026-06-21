# Clover

A **creative imageboard** — Pinterest-style masonry board meets Reddit-style feeds,
with built-in in-browser creation tools (pixel art first). Public UGC platform,
operated from the EU, built almost entirely by AI agents under one human overseer.

> **Status: planning.** This repo currently contains the architecture and plan
> only — no production code yet. Implementation follows the [ROADMAP](ROADMAP.md)
> in later sessions, after overseer approval.

## Read the docs in this order

1. **[ASSUMPTIONS.md](ASSUMPTIONS.md)** — confirmed product/cost/legal decisions +
   open questions for the overseer.
2. **[RESEARCH.md](RESEARCH.md)** — the technology options weighed, each with the
   constraint that drove the pick.
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** — the chosen design: diagram, data model,
   repo layout, and the extensible tool interface.
4. **[ROADMAP.md](ROADMAP.md)** — the incremental build plan as vertical slices.
5. **[CLAUDE.md](CLAUDE.md)** — conventions + guardrails every session must follow
   (loaded automatically each session).
6. **[PROGRESS.md](PROGRESS.md)** — live build state (read after CLAUDE.md to
   resume).
7. **[docs/adr/](docs/adr/)** — Architecture Decision Records (one per significant
   choice).

## The stack (one job per vendor)

- **Cloudflare** — SvelteKit on Workers, R2 + CDN for media, Queues + Workers AI for
  the async upload/safety pipeline.
- **Supabase (EU/Frankfurt)** — Postgres + RLS, Auth, Realtime, pgvector.

See [RESEARCH.md](RESEARCH.md) for why, [ARCHITECTURE.md](ARCHITECTURE.md) for how.

## How this project is built

AI agents implement; **CI + a separate reviewer agent** verify the code; the **human
overseer** decides product/cost/legal questions in plain language and holds the
production credentials + merge button. The full operating contract — security hard
rules, the #2 human gates, the reviewer checklist, and the drift-audit cadence — is
in [CLAUDE.md](CLAUDE.md).
