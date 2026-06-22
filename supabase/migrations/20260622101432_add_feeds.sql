SET check_function_bodies = false;

-- Slice 5 — Feeds. Adds posts.hot_score (+ trigger + index) for the Hot feed and a
-- minimal one-way follows table for the Following feed. See supabase/schemas/03_posts.sql
-- and supabase/schemas/05_follows.sql.
--
-- Hand-edits to the generated diff:
--   • added the security-critical REVOKE ALL on follows (the diff tool drops it; Supabase
--     default privileges otherwise grant anon/authenticated broad access);
--   • dropped a no-op post_media INSERT grant reshuffle the diff emitted (same columns,
--     reordered — no semantic change).

-- ── posts.hot_score: server-computed Hot rank (clients have no grant on it) ──────────
-- Reddit-style: log10(score) + an absolute-time term. Score is 0 until ratings (Slice 6),
-- so this is the time term alone and Hot mirrors New. Mirrors src/lib/domain/feed/hot-score.ts.
CREATE FUNCTION public.set_post_hot_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
	new.hot_score := extract(epoch from coalesce(new.created_at, now())) / 45000;
	return new;
end;
$function$;

ALTER TABLE public.posts ADD COLUMN hot_score double precision DEFAULT 0 NOT NULL;

-- Expose hot_score to readers; clients still cannot INSERT/UPDATE it (no grant), so the
-- feed can't be skewed. (The diff revokes + re-grants SELECT to add the column.)
REVOKE SELECT (author_id, created_at, description, edited_at, id, moderation_state, title) ON public.posts FROM anon;
GRANT SELECT (author_id, created_at, description, edited_at, hot_score, id, moderation_state, title) ON public.posts TO anon;
REVOKE SELECT (author_id, created_at, description, edited_at, id, moderation_state, title) ON public.posts FROM authenticated;
GRANT SELECT (author_id, created_at, description, edited_at, hot_score, id, moderation_state, title) ON public.posts TO authenticated;

CREATE INDEX posts_hot_idx ON public.posts (hot_score DESC, id DESC) WHERE moderation_state = 'approved'::public.moderation_state;
CREATE TRIGGER posts_set_hot_score BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_post_hot_score();

-- Hot feed keyset (cursor = last page id). Resolves the (hot_score, id) boundary in SQL so
-- the float never round-trips through the client (PostgREST truncates float8, which would
-- dup/skip rows at page edges). SECURITY INVOKER → RLS applies; Hot is public. Trade-off: if
-- the cursor post is deleted/held mid-scroll the boundary CTE is empty and the next page
-- comes back empty (pagination ends early until refresh) — no dup/skip, acceptable.
CREATE FUNCTION public.hot_feed_page(p_limit integer, p_cursor_id uuid DEFAULT NULL)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
	with boundary as (
		select hot_score, id from public.posts where id = p_cursor_id
	)
	select p.id
	from public.posts p
	where p.moderation_state = 'approved'
		and (
			p_cursor_id is null
			or p.hot_score < (select hot_score from boundary)
			or (p.hot_score = (select hot_score from boundary) and p.id < (select id from boundary))
		)
	order by p.hot_score desc, p.id desc
	limit p_limit;
$function$;

-- The diff tool drops the default PUBLIC execute revoke; hand-add it. Hot is public, so
-- anon + authenticated may execute (everyone who can read the board).
REVOKE EXECUTE ON FUNCTION public.hot_feed_page(integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.hot_feed_page(integer, uuid) TO anon, authenticated;

-- ── follows: one-way edges driving the Following feed (read-only from clients) ────────
CREATE TABLE public.follows (follower_id uuid NOT NULL, followee_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
COMMENT ON TABLE public.follows IS 'One-way follow edges; drives the Following feed. Read-only from clients until Slice 10 adds the follow button + write policies.';
ALTER TABLE public.follows ADD CONSTRAINT follows_check CHECK (follower_id <> followee_id);
ALTER TABLE public.follows ADD CONSTRAINT follows_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followee_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Security-critical REVOKE the diff tool drops (default privileges otherwise grant broad
-- access). Read-only for signed-in users; no anon access (Following requires sign-in).
REVOKE ALL ON public.follows FROM anon, authenticated;
GRANT SELECT (created_at, followee_id, follower_id) ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

CREATE POLICY "Users can view their own follows" ON public.follows FOR SELECT USING (((SELECT auth.uid() AS uid) = follower_id));
