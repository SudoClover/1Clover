-- RLS + privilege guarantees for public.media (CLAUDE.md §6, ARCHITECTURE §4.3).
-- The dynamic two-user "can't see each other's pending media" checks live in the
-- TypeScript integration tests (they need real confirmed auth users). This file
-- covers the static guarantees pgTAP proves best: column privacy, no client
-- writes, the exact SELECT policies, the shared enums, and the board index.
begin;
select plan(19);

-- Table exists and RLS is on. ("every base table has RLS" is asserted in
-- 01_profiles_rls.test.sql, which scans all of public — it now covers media too.)
select has_table('public', 'media', 'media table exists');
select ok(
	(select relrowsecurity from pg_class where oid = 'public.media'::regclass),
	'RLS is enabled on media'
);

-- storage_key / checksum / byte_size are server-internal: never readable by clients.
select ok(not has_column_privilege('anon', 'public.media', 'storage_key', 'SELECT'),
	'anon cannot SELECT storage_key');
select ok(not has_column_privilege('authenticated', 'public.media', 'storage_key', 'SELECT'),
	'authenticated cannot SELECT storage_key');
select ok(not has_column_privilege('anon', 'public.media', 'checksum', 'SELECT'),
	'anon cannot SELECT checksum');
select ok(not has_column_privilege('authenticated', 'public.media', 'checksum', 'SELECT'),
	'authenticated cannot SELECT checksum');
select ok(not has_column_privilege('anon', 'public.media', 'byte_size', 'SELECT'),
	'anon cannot SELECT byte_size');

-- Public columns are readable.
select ok(has_column_privilege('anon', 'public.media', 'id', 'SELECT'),
	'anon can SELECT id (public column)');
select ok(has_column_privilege('anon', 'public.media', 'moderation_state', 'SELECT'),
	'anon can SELECT moderation_state (public column)');

-- Clients have NO write privilege: all media writes go through the service role.
select ok(not has_table_privilege('authenticated', 'public.media', 'INSERT'),
	'authenticated cannot INSERT media');
select ok(not has_table_privilege('authenticated', 'public.media', 'UPDATE'),
	'authenticated cannot UPDATE media');
select ok(not has_table_privilege('authenticated', 'public.media', 'DELETE'),
	'authenticated cannot DELETE media');
select ok(not has_table_privilege('anon', 'public.media', 'INSERT'),
	'anon cannot INSERT media');

-- Exactly the two expected read policies (no accidental write policy).
select policies_are(
	'public', 'media',
	array['Approved media is viewable by everyone', 'Owners can view their own media'],
	'media has exactly the expected RLS policies'
);

-- Shared content enums carry their full documented value sets (ARCHITECTURE §4).
select enum_has_labels('public', 'media_kind', array['image', 'audio', 'video'],
	'media_kind has the expected labels');
select enum_has_labels('public', 'moderation_state', array['pending', 'approved', 'held', 'removed'],
	'moderation_state has the expected labels');
select enum_has_labels('public', 'processing_state', array['pending', 'processing', 'ready', 'failed'],
	'processing_state has the expected labels');

-- Indexes backing the board query + owner library exist.
select has_index('public', 'media', 'media_board_idx', 'board partial index exists');
select has_index('public', 'media', 'media_owner_created_idx', 'owner library index exists');

select * from finish();
rollback;
