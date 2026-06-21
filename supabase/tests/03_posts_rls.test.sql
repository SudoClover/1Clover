-- RLS + privilege guarantees for public.posts and public.post_media (CLAUDE.md §6).
-- The dynamic two-user "can't edit each other's posts" checks live in the TypeScript
-- integration tests (they need real auth users). This file proves the static guarantees
-- — above all that a client can edit only title/description, NEVER moderation_state.
begin;
select plan(29);

select has_table('public', 'posts', 'posts table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.posts'::regclass), 'RLS enabled on posts');
select has_table('public', 'post_media', 'post_media table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.post_media'::regclass), 'RLS enabled on post_media');

-- THE critical guarantee: clients cannot change moderation_state (no self-un-hold)
-- and cannot rewrite ownership or timestamps.
select ok(not has_column_privilege('authenticated', 'public.posts', 'moderation_state', 'UPDATE'),
	'authenticated cannot UPDATE moderation_state');
select ok(has_column_privilege('authenticated', 'public.posts', 'title', 'UPDATE'),
	'authenticated can UPDATE title');
select ok(has_column_privilege('authenticated', 'public.posts', 'description', 'UPDATE'),
	'authenticated can UPDATE description');
select ok(not has_column_privilege('authenticated', 'public.posts', 'author_id', 'UPDATE'),
	'authenticated cannot UPDATE author_id');
select ok(not has_column_privilege('authenticated', 'public.posts', 'created_at', 'UPDATE'),
	'authenticated cannot UPDATE created_at');
select ok(not has_column_privilege('authenticated', 'public.posts', 'edited_at', 'UPDATE'),
	'authenticated cannot UPDATE edited_at (server-stamped)');

-- Insert: only author_id/title/description; never moderation_state.
select ok(not has_column_privilege('authenticated', 'public.posts', 'moderation_state', 'INSERT'),
	'authenticated cannot INSERT moderation_state');
select ok(has_column_privilege('authenticated', 'public.posts', 'title', 'INSERT'),
	'authenticated can INSERT title');
select ok(has_column_privilege('authenticated', 'public.posts', 'author_id', 'INSERT'),
	'authenticated can INSERT author_id');
select ok(has_table_privilege('authenticated', 'public.posts', 'DELETE'),
	'authenticated can DELETE own posts (row-gated by RLS)');

-- Anonymous visitors can read public columns but never write.
select ok(has_column_privilege('anon', 'public.posts', 'title', 'SELECT'),
	'anon can SELECT title (public column)');
select ok(not has_table_privilege('anon', 'public.posts', 'INSERT'), 'anon cannot INSERT posts');
select ok(not has_table_privilege('anon', 'public.posts', 'UPDATE'), 'anon cannot UPDATE posts');
select ok(not has_table_privilege('anon', 'public.posts', 'DELETE'), 'anon cannot DELETE posts');

select policies_are(
	'public', 'posts',
	array[
		'Approved posts are viewable by everyone',
		'Authors can view their own posts',
		'Authors can create their own posts',
		'Authors can update their own posts',
		'Authors can delete their own posts'
	],
	'posts has exactly the expected RLS policies'
);

-- post_media: clients may only reorder (position); link/unlink gated by policy.
select ok(has_column_privilege('authenticated', 'public.post_media', 'position', 'UPDATE'),
	'authenticated can UPDATE position');
select ok(not has_column_privilege('authenticated', 'public.post_media', 'post_id', 'UPDATE'),
	'authenticated cannot UPDATE post_id');
select ok(has_column_privilege('authenticated', 'public.post_media', 'media_id', 'INSERT'),
	'authenticated can INSERT media_id');
select ok(has_table_privilege('authenticated', 'public.post_media', 'DELETE'),
	'authenticated can DELETE post_media (row-gated by RLS)');
select ok(not has_table_privilege('anon', 'public.post_media', 'INSERT'), 'anon cannot INSERT post_media');

select policies_are(
	'public', 'post_media',
	array[
		'Post media is viewable when the post is',
		'Authors can link their own media to their posts',
		'Authors can reorder media on their posts',
		'Authors can unlink media from their posts'
	],
	'post_media has exactly the expected RLS policies'
);

select has_trigger('public', 'posts', 'posts_set_edited', 'edited_at trigger exists on posts');

-- create_post RPC: exists, signed-in users may execute, anonymous visitors may not.
select has_function('public', 'create_post', array['text', 'text', 'uuid[]'],
	'create_post(text, text, uuid[]) exists');
select ok(has_function_privilege('authenticated', 'public.create_post(text, text, uuid[])', 'EXECUTE'),
	'authenticated can EXECUTE create_post');
select ok(not has_function_privilege('anon', 'public.create_post(text, text, uuid[])', 'EXECUTE'),
	'anon cannot EXECUTE create_post');

select * from finish();
rollback;
