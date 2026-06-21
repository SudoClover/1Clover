# ADR-0004 — Single repository with folder-enforced layers

**Status:** Accepted
**Date:** 2026-06-21

## Context
The project must be **AI-decodable**: a fresh session should see the whole system in
one place. It must also be **layered** (UI / API / domain / storage) so features
slot in without rewrites. We have no second consumer of any internal package yet.

## Decision
Use a **single repository** containing the SvelteKit app, `supabase/` (schema +
migrations + tests), and a `workers/media-consumer/` queue Worker. Enforce the layer
boundaries with **folders + lint rules**, not (yet) with separate packages. Pure
domain logic lives in `src/lib/domain/`; server-only code in `src/lib/server/`.

## Consequences
- A session has full context in one place; one CI; one history.
- Boundaries are conventions backed by lint (e.g. no importing `server/` from
  components, no I/O in `domain/`) rather than package walls — lighter weight.
- Everything versions together — fine at this scale.
- If a real second consumer of a folder appears, promoting it to a pnpm workspace
  package is mechanical.

## Alternatives
- **Multi-package monorepo (pnpm workspaces) now** — premature tooling overhead
  before there's a second consumer.
- **Polyrepo** — a session can't see the whole system; fails AI-decodability.
