# ADR-0002 — Supabase (EU) for database, auth, realtime, and vector

**Status:** Accepted
**Date:** 2026-06-21

## Context
A public UGC platform's hardest correctness problem is **data isolation** between
users, and the overseer cannot review code. We need a database, authentication,
realtime (chat), and vector similarity — and we need access control to be
**auditable and testable**, not scattered across handlers. We are EU-based and need
EU data residency for personal data (GDPR).

## Decision
Use **Supabase Cloud, EU region (Frankfurt)**: managed Postgres + Auth + Realtime +
`pgvector` + Storage, with **Row-Level Security (RLS)** as the access-control
mechanism — access rules live once, in the database, as SQL. Move to **Pro tier**
before launch (free projects pause after a week idle). Separate dev and prod
projects.

## Consequences
- Access control becomes auditable SQL, testable with pgTAP (the two-user negative
  test) — turning the riskiest area into something verifiable.
- Four needs (DB/auth/realtime/vector) covered by one EU-hosted vendor; far less to
  run/secure/back up for a solo operator.
- Vendor coupling; some features (PITR, branching) are paid — accepted within budget.
- The Supabase **secret key bypasses RLS** → must be server-only; its leak = full
  breach (see ADR-0008).

## Alternatives
- **Self-hosted Postgres + Auth.js + a realtime server + a vector DB** — four moving
  parts to operate; violates "simple"; explodes solo burden.
- **Firebase** — document model fights relational feeds/ranking; weaker SQL-shaped
  access control; not EU-Postgres.
- **PlanetScale/Neon + bolt-ons** — great DB but still must assemble auth/realtime/
  vector separately.
