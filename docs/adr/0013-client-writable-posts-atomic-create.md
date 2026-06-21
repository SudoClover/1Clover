# ADR-0013 — Client-writable posts: atomic create via a SECURITY INVOKER RPC

**Status:** Accepted
**Date:** 2026-06-22

## Context

`posts`/`post_media` (Slice 3) are the **first client-writable tables**. Until now
every write went through the service-role key (`media`, profiles trigger). Posts are
different: an author creates/edits/deletes their **own** rows directly, and RLS — not
a privileged server routine — is the access-control boundary.

Two requirements shape the create path:

1. **Ownership must stay enforced by RLS**, so a forged `author_id` or linking media
   the user doesn't own is impossible regardless of what the app sends.
2. **A post and its media links must commit atomically.** A post with no media is
   meaningless (it can't render a cover, it won't appear on the board), so a partial
   write — post inserted, link rejected — must not leave an orphan.

The Supabase JS client issues one statement per call, so an app-level "insert the
post, then insert the links" sequence is **not transactional**: if a link is rejected
(e.g. RLS denies media the user doesn't own) the already-inserted post survives as an
orphan, and a compensating delete is best-effort.

## Decision

Create posts through a Postgres function, `public.create_post(p_title, p_description,
p_media_ids uuid[]) returns uuid`, called via `client.rpc(...)` with the **per-request
authed client**:

- **`SECURITY INVOKER`** (the default, stated explicitly): the function runs with the
  **caller's** privileges and RLS. The `insert into posts` is checked by the
  `author_id = auth.uid()` policy; each `insert into post_media` is checked by the
  policy requiring the caller to own both the post and the media. Linking someone
  else's media raises inside the function, so the **whole function transaction rolls
  back** — no orphan. This is the opposite of `SECURITY DEFINER`, which would bypass
  RLS and is explicitly *not* used.
- **`author_id` is taken from `auth.uid()` inside the function**, never from a client
  argument — it cannot be forged.
- **`set search_path = ''`** with fully-qualified names (`public.*`, `auth.uid()`),
  matching the project's other functions.
- **Execute grant locked down:** the default `PUBLIC` execute grant is revoked;
  only `authenticated` may execute. (pgTAP asserts `anon` cannot.)

Edit and delete need no RPC — they are single-statement `update`/`delete` through the
authed client, gated by the same owner RLS policies (a non-owner write simply affects
zero rows). The board read is a keyset query (`(created_at, id)` cursor on the partial
`approved` index); the cover is the lowest-`position` approved+ready media's thumbnail,
computed in `src/lib/server/db/posts.ts`.

## Consequences

- **Integrity is in the database, not hopeful app code.** The two-user posts
  integration test proves: create→board→detail, non-owner edit/delete denied, and that
  linking another user's media throws **and leaves no orphan post**.
- **Column privacy still holds.** Under invoker rights the function is bound by the
  `authenticated` column grants — it can only write `author_id/title/description` on
  `posts` and `post_id/media_id/position` on `post_media`; it cannot set
  `moderation_state`/`edited_at` (a user still can't self-approve or self-un-hold).
- **A reusable pattern.** Ratings (Slice 6) and comments (Slice 7) will want the same
  "atomic, RLS-enforced, owner-pinned write" shape; this is the template.
- **Migration gotcha (again):** `supabase db diff` emits the default `PUBLIC` execute
  grant on the function; the `REVOKE … FROM public, anon` + `GRANT … TO authenticated`
  are hand-maintained in the migration, like the table `REVOKE`s (see PROGRESS).

## Alternatives

- **App-level insert + compensating delete** — not transactional; an orphan survives a
  failed compensating delete. Rejected for a data-integrity-critical path.
- **`SECURITY DEFINER` function doing its own ownership checks** — bypasses RLS, so the
  checks live in PL/pgSQL instead of the policies that already exist; larger trusted
  surface, easy to drift from the RLS source of truth. Rejected.
- **Grant `authenticated` multi-row insert and orchestrate client-side** — widens the
  write surface and still isn't atomic across the post + links. Rejected.
