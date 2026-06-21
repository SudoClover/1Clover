# Architecture Decision Records (ADRs)

Each ADR records **one significant decision**: its context, the decision, the
consequences, and the alternatives rejected. ADRs are immutable once accepted — to
change a decision, add a new ADR that **supersedes** the old one (don't rewrite
history).

Write an ADR for any significant choice (CLAUDE.md §12). Keep them short.

## Format

```
# ADR-NNNN — Title
Status: Proposed | Accepted | Superseded by ADR-XXXX
Date: YYYY-MM-DD
Context: the forces at play and the constraint that dominates.
Decision: what we chose.
Consequences: what follows (good and bad).
Alternatives: what we rejected and why.
```

## Index

| ADR | Decision |
|---|---|
| [0001](0001-sveltekit-frontend.md) | SvelteKit on Cloudflare Workers as the app framework |
| [0002](0002-supabase-backend.md) | Supabase (EU) for DB + auth + realtime + vector |
| [0003](0003-media-r2-cdn.md) | Cloudflare R2 + CDN for media; DB stores references only |
| [0004](0004-monorepo-layout.md) | Single repository with folder-enforced layers |
| [0005](0005-tool-registry.md) | In-process `CreationTool` registry as the one extension point |
| [0006](0006-feeds-and-realtime.md) | Postgres-computed feeds + Supabase Realtime |
| [0007](0007-media-pipeline.md) | Async media pipeline (presign → Queues → consumer) |
| [0008](0008-auth-supabase-getclaims.md) | Supabase Auth; authorize via `getClaims()` |
| [0009](0009-recommendations-tags-then-vectors.md) | Tag/metadata recommendations first, pgvector later |
| [0010](0010-editor-libraries.md) | Per-tool canvas libraries behind the registry |
| [0011](0011-migrations-declarative.md) | Declarative schema + reviewed migrations, CI-to-prod only |

All decisions trace back to the five principles (readable, AI-decodable, simple/
layered/expandable, secure-by-default, media-as-references) and the overseer
interview ([ASSUMPTIONS.md](../../ASSUMPTIONS.md)). Rationale detail lives in
[RESEARCH.md](../../RESEARCH.md).
