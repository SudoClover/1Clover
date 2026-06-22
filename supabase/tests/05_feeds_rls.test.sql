-- RLS + privilege guarantees for the Slice 5 feed schema (CLAUDE.md §6): the new
-- follows table and posts.hot_score. The dynamic feed-ordering / two-user checks live in
-- the TypeScript integration tests; this file proves the static guarantees — above all
-- that a client can NEVER write hot_score (so the Hot feed can't be skewed) and that
-- follows is read-only + owner-scoped until Slice 10 adds the follow button.
begin;
select plan(19);

-- ── follows ──────────────────────────────────────────────────────────────────
select has_table('public', 'follows', 'follows table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.follows'::regclass), 'RLS enabled on follows');

select policies_are(
	'public', 'follows',
	array['Users can view their own follows'],
	'follows has exactly the expected RLS policies (read-only until Slice 10)'
);

select ok(has_column_privilege('authenticated', 'public.follows', 'follower_id', 'SELECT'),
	'authenticated can SELECT follower_id');
select ok(has_column_privilege('authenticated', 'public.follows', 'followee_id', 'SELECT'),
	'authenticated can SELECT followee_id');
select ok(has_column_privilege('authenticated', 'public.follows', 'created_at', 'SELECT'),
	'authenticated can SELECT created_at');

-- No client writes yet (the follow button + write policies arrive in Slice 10).
select ok(not has_table_privilege('authenticated', 'public.follows', 'INSERT'),
	'authenticated cannot INSERT follows (deferred to Slice 10)');
select ok(not has_table_privilege('authenticated', 'public.follows', 'UPDATE'),
	'authenticated cannot UPDATE follows');
select ok(not has_table_privilege('authenticated', 'public.follows', 'DELETE'),
	'authenticated cannot DELETE follows');
-- Following requires sign-in: anonymous visitors get no access at all.
select ok(not has_table_privilege('anon', 'public.follows', 'SELECT'),
	'anon cannot SELECT follows');

-- ── posts.hot_score: readable, never client-writable ─────────────────────────
select ok(has_column_privilege('anon', 'public.posts', 'hot_score', 'SELECT'),
	'anon can SELECT hot_score');
select ok(has_column_privilege('authenticated', 'public.posts', 'hot_score', 'SELECT'),
	'authenticated can SELECT hot_score');
select ok(not has_column_privilege('authenticated', 'public.posts', 'hot_score', 'INSERT'),
	'authenticated cannot INSERT hot_score (feed cannot be skewed)');
select ok(not has_column_privilege('authenticated', 'public.posts', 'hot_score', 'UPDATE'),
	'authenticated cannot UPDATE hot_score (feed cannot be skewed)');

select has_trigger('public', 'posts', 'posts_set_hot_score', 'hot_score trigger exists on posts');
select ok(
	(select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public' and p.proname = 'set_post_hot_score') = 1,
	'set_post_hot_score() exists'
);

select ok(
	(select count(*) from pg_indexes where schemaname = 'public' and indexname = 'posts_hot_idx') = 1,
	'posts_hot_idx (Hot feed keyset index) exists'
);

-- hot_feed_page RPC: public-executable (Hot is public), and SECURITY INVOKER so RLS still
-- applies — it can't be used to read non-approved posts.
select ok(has_function_privilege('anon', 'public.hot_feed_page(integer, uuid)', 'EXECUTE'),
	'anon can EXECUTE hot_feed_page (Hot is public)');
select ok(
	not (select prosecdef from pg_proc where oid = 'public.hot_feed_page(integer, uuid)'::regprocedure),
	'hot_feed_page is SECURITY INVOKER (RLS enforced)'
);

select * from finish();
rollback;
