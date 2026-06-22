# ADR-0014 — Tags & "similar posts": tags-only this slice, pure overlap ranking

Status: Accepted
Date: 2026-06-22

Context: Slice 4 lets a post carry discovery labels and surfaces "similar posts" on the
detail page. ADR-0009 already set the direction (tag/metadata recommendations first,
pgvector later). Two forces shaped the build: (1) the ROADMAP goal names "tags + structured
metadata", but the slice's binding *Touches* list names only `tags`/`post_tags`, and scope
discipline (CLAUDE.md §8) forbids speculative columns; (2) ranking must be testable so it
can't be silently skewed (CLAUDE.md threat note), and must not lock us out of pgvector.

Decision:
- **Tags only — no `posts.metadata` column this slice** (overseer call). Similarity is tag
  overlap. `metadata` is added later only when a concrete consumer exists.
- **`tags` is global/shared**; `post_tags` is the owner-owned join (RLS mirrors `post_media`).
  A post's tags are replaced atomically by a `set_post_tags` **SECURITY INVOKER** RPC
  (get-or-create each tag → relink), reusing the ADR-0013 atomic-write template. An explicit
  owner check fails a non-owner fast (no orphan tag rows). Tag input is normalized + charset/
  length/count-capped in pure domain code, with a DB `CHECK` as the backstop.
- **Ranking is a coarse DB filter + a pure function.** The server fetches candidates sharing
  ≥1 tag (approved-only, capped); the pure `findSimilar(targetTagIds, candidates, limit)`
  ranks them by shared-tag count with a deterministic tie-break. `findSimilar` is the **stable
  seam**: a future pgvector slice swaps the scoring without touching any caller, and the
  `/api/posts/[id]/similar` route is the stable interface the UI calls.

Consequences:
- (+) No premature schema; similarity works today and is fully unit-tested (pure ranking) +
  integration-tested (real RLS, two users, approved-only, target/held exclusion).
- (+) The atomic owner-checked RPC keeps "a user tags only their own post" enforced in the DB.
- (−) Shared-tag-count similarity is coarse (no semantic closeness) until pgvector — accepted;
  the interface is built to absorb that change.
- (−) `tags` accumulates globally (no GC / trending / moderation) — out of scope, revisit when
  a tag-moderation or trending slice lands.

Alternatives:
- *Add `metadata jsonb` now and factor it into overlap* — rejected: speculative, no concrete
  field defined, violates scope discipline. Additive later if needed.
- *Rank entirely in SQL (count + order)* — rejected: hides the ranking from unit tests and
  couples it to PostgREST; the pure-function split keeps ranking deterministic and portable.
- *Per-author / private tags* — rejected: global tags are what make overlap meaningful.
