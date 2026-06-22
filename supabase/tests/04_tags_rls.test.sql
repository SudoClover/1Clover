-- RLS + privilege guarantees for public.tags and public.post_tags (CLAUDE.md §6). The
-- dynamic two-user "can't tag each other's posts" checks live in the TypeScript integration
-- tests (they need real auth users). This file proves the static guarantees: tags are
-- read-all / insert-only for clients, and only a post's owner can link/unlink its tags.
begin;
select plan(19);

select has_table('public', 'tags', 'tags table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.tags'::regclass), 'RLS enabled on tags');
select has_table('public', 'post_tags', 'post_tags table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.post_tags'::regclass), 'RLS enabled on post_tags');

-- tags: any signed-in user may introduce a tag name, but never edit or delete tags.
select ok(has_column_privilege('authenticated', 'public.tags', 'name', 'INSERT'),
	'authenticated can INSERT tag name');
select ok(not has_column_privilege('authenticated', 'public.tags', 'name', 'UPDATE'),
	'authenticated cannot UPDATE tag name');
select ok(not has_table_privilege('authenticated', 'public.tags', 'DELETE'),
	'authenticated cannot DELETE tags');
select ok(has_column_privilege('anon', 'public.tags', 'name', 'SELECT'),
	'anon can SELECT tag name (public)');
select ok(not has_table_privilege('anon', 'public.tags', 'INSERT'), 'anon cannot INSERT tags');

-- post_tags: clients link/unlink (row-gated by RLS), never update; anon cannot write.
select ok(has_column_privilege('authenticated', 'public.post_tags', 'tag_id', 'INSERT'),
	'authenticated can INSERT post_tags tag_id');
select ok(has_table_privilege('authenticated', 'public.post_tags', 'DELETE'),
	'authenticated can DELETE post_tags (row-gated by RLS)');
select ok(not has_table_privilege('authenticated', 'public.post_tags', 'UPDATE'),
	'authenticated cannot UPDATE post_tags (links are not edited, only replaced)');
select ok(not has_table_privilege('anon', 'public.post_tags', 'INSERT'), 'anon cannot INSERT post_tags');
select ok(has_column_privilege('anon', 'public.post_tags', 'post_id', 'SELECT'),
	'anon can SELECT post_tags (public)');

select policies_are(
	'public', 'tags',
	array['Tags are viewable by everyone', 'Authenticated users can create tags'],
	'tags has exactly the expected RLS policies'
);

select policies_are(
	'public', 'post_tags',
	array[
		'Post tags are viewable when the post is',
		'Authors can tag their own posts',
		'Authors can untag their own posts'
	],
	'post_tags has exactly the expected RLS policies'
);

-- set_post_tags RPC: exists, signed-in users may execute, anonymous visitors may not.
select has_function('public', 'set_post_tags', array['uuid', 'text[]'],
	'set_post_tags(uuid, text[]) exists');
select ok(has_function_privilege('authenticated', 'public.set_post_tags(uuid, text[])', 'EXECUTE'),
	'authenticated can EXECUTE set_post_tags');
select ok(not has_function_privilege('anon', 'public.set_post_tags(uuid, text[])', 'EXECUTE'),
	'anon cannot EXECUTE set_post_tags');

select * from finish();
rollback;
