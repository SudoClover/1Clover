# ADR-0006 — Postgres-computed feeds + Supabase Realtime

**Status:** Accepted
**Date:** 2026-06-21

## Context
We need Reddit-style switchable feeds (New, Hot, Top day/week/all, Following) whose
ranking must be **trustworthy and testable** (ratings feed the rankings — feed
integrity matters), and realtime updates for DMs and live feed/notification changes.
We want no extra infrastructure or vendor at launch scale.

## Decision
**Feeds** are computed in **Postgres**: New = recency (keyset pagination); Hot = a
time-decayed score stored on `posts.hot_score`, updated on rating change and by a
scheduled recompute (Cron Worker or `pg_cron`); Top = windowed rating aggregates;
Following = posts from the `follows` graph. The ranking math is implemented as
**pure functions** in `src/lib/domain/feed/` (unit-tested without a DB) and applied
via SQL. **Realtime** (DMs, live updates) uses **Supabase Realtime** (broadcast +
Postgres-changes + presence), which is RLS-aware.

## Consequences
- One source of truth for ranking; the algorithm is readable + unit-testable in
  isolation, so it can't be silently skewed.
- No extra ranking service or realtime vendor.
- Hot-score recompute runs off the request path (scheduled).
- Realtime channels inherit RLS — participants-only DMs are enforced in the DB.

## Alternatives
- **External ranking/search service** — premature for launch scale; new vendor;
  violates "simple".
- **Cloudflare Durable Objects for realtime** — we'd hand-build presence/fan-out/
  auth; more code than reusing Supabase Realtime.
- **Pusher/Ably** — new vendor + cost for something already in-stack.
