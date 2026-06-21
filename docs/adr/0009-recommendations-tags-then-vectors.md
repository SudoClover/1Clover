# ADR-0009 — Tag/metadata recommendations first, pgvector embeddings later

**Status:** Accepted
**Date:** 2026-06-21

## Context
Opening a post must show "similar posts". The brief sequences this explicitly:
metadata/tag matching first, content embeddings later. We want the first version to
be cheap, explainable, and debuggable, with a seam for semantic similarity later
without a rewrite or a new vendor.

## Decision
At launch, compute "similar posts" from **tag + structured-`metadata` overlap**, as
a **pure scoring function** in `src/lib/domain/recommend/` applied via SQL, behind a
stable `findSimilar(postId)` interface. Later, add **`pgvector` content embeddings**
(already available in Supabase, ADR-0002) **behind the same interface** — callers
don't change.

## Consequences
- The first recommendation feature is a simple, explainable SQL query (no ML).
- Embeddings slot in later as an implementation swap behind `findSimilar`.
- Tag input must be normalized/validated/capped to keep the signal clean and prevent
  abuse.

## Alternatives
- **Start with embeddings** — more moving parts (embedding generation, vector index
  tuning) before the simple version proves the feature; deferred.
- **External recommendation service** — new vendor; premature.
