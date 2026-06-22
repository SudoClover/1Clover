# ADR-0015 — Feeds: epoch-additive Hot score (no cron), SQL keyset RPC, minimal follows

Status: Accepted (refines ADR-0006)
Date: 2026-06-22

Context: Slice 5 ships the switchable feeds named in ADR-0006 — New / Hot / Top (day/week/
all) / Following. Three forces shaped the build: (1) ratings don't exist until Slice 6, so
Hot/Top have no popularity signal yet, but the ranking machinery + stable interface must
land now; (2) ranking must be pure + tested so it can't be silently skewed (CLAUDE.md threat
note); (3) the Following feed needs a `follows` source, which the ROADMAP said could be
introduced here or in Slice 10.

Decision:
- **Hot score is epoch-additive (Reddit-style): `log10(max(score,1)) + epoch_seconds/45000`.**
  Because the time term is an *absolute* instant (not "age since now"), the value only changes
  when the **score** changes — so it needs **no scheduled/cron recompute**, only a recompute
  on rating change (Slice 6). This **refines ADR-0006**, which assumed a scheduled recompute:
  the additive form removes that job entirely (no spend, fully deterministic). `hot_score` is a
  stored, indexed `posts` column set by a `BEFORE INSERT` trigger; clients have no grant on it,
  so the feed can't be skewed. The canonical formula is the pure `hotScore` in
  `src/lib/domain/feed/` (unit-tested); the SQL trigger mirrors it and an integration test
  asserts the stored value equals the pure spec (parity guard against drift).
- **Until ratings exist (Slice 6) every score is 0, so Hot mirrors New and Top is recency
  within its window** (overseer informed). Slice 6 makes them diverge by recomputing
  `hot_score` and switching Top's primary sort to rating count — without changing these
  interfaces.
- **Hot paginates via a SQL keyset RPC (`hot_feed_page`), cursor = the last post id.**
  PostgREST truncates `float8` to ~15 digits, so a `hot_score` can't round-trip through the
  client — a float cursor duplicated/skipped rows at page edges (caught by an integration
  test). The RPC resolves the `(hot_score, id)` boundary in SQL, so the float never leaves the
  database. New/Top/Following keyset on `(created_at, id)`, which round-trips exactly as text.
- **A minimal one-way `follows` table is introduced here (overseer call), read-only from
  clients.** It drives the Following feed (approved posts by authors the viewer follows,
  newest-first). The follow/unfollow **button**, write policies, and friendships are deferred
  to Slice 10; until then Following shows an empty "follow people" state and is seeded via the
  service role in tests.

Consequences:
- (+) No cron/scheduled job and no new vendor for ranking; one pure, tested source of truth.
- (+) Hot pagination is exact and future-proof for real score ties (Slice 6).
- (+) The four feed interfaces are stable; Slice 6 fills in the popularity signal underneath.
- (−) Hot/Top look like New until ratings land — accepted (honest seam, mirrors ADR-0009/0014).
- (−) Hot costs two queries per page (RPC for ids, then a cover fetch) — acceptable; keeps the
  media embed typed in PostgREST rather than hand-rolled in SQL.
- (−) `follows` exists before it can be written via the UI — accepted; the ROADMAP sanctioned
  introducing it minimally here, and Slice 10 owns the write surface + anti-spam.

Alternatives:
- *Multiplicative time-decay + scheduled recompute (ADR-0006's wording)* — rejected: needs a
  cron job to re-rank every post as time passes; the additive form is equivalent in ordering
  with zero recompute.
- *Float `hot_score` cursor over PostgREST* — rejected: doesn't round-trip (proven), dups/skips.
- *Compute `hot_score` in a SQL generated column* — rejected: the pure-TS function is the
  tested spec (ADR-0006); a trigger mirroring it + a parity test keeps ranking out of an
  untested SQL expression and is easy to extend in Slice 6.
- *Defer Following entirely to Slice 10* — rejected by the overseer: ship the full feed
  interface now, defer only the write button.
