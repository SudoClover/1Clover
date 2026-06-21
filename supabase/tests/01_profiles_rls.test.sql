-- RLS + privilege guarantees for public.profiles (CLAUDE.md §6).
-- The dynamic two-user "can't touch each other's data" checks live in the
-- TypeScript integration tests (they need real confirmed auth users via the
-- admin API). This file covers the static guarantees that pgTAP proves best.
begin;
select plan(12);

-- Table exists and RLS is on.
select has_table('public', 'profiles', 'profiles table exists');
select ok(
	(select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
	'RLS is enabled on profiles'
);

-- Every base table in public must have RLS enabled (catches future omissions).
select is_empty(
	$$ select c.relname from pg_class c
	   join pg_namespace n on n.oid = c.relnamespace
	   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
	'every base table in public has RLS enabled'
);

-- birthdate is private: not readable by client roles, public columns are.
select ok(not has_column_privilege('anon', 'public.profiles', 'birthdate', 'SELECT'),
	'anon cannot SELECT birthdate');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'birthdate', 'SELECT'),
	'authenticated cannot SELECT birthdate');
select ok(has_column_privilege('anon', 'public.profiles', 'username', 'SELECT'),
	'anon can SELECT username (public column)');

-- Clients cannot change username or birthdate; can change display_name + bio.
select ok(not has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE'),
	'authenticated cannot UPDATE username');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'birthdate', 'UPDATE'),
	'authenticated cannot UPDATE birthdate');
select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
	'authenticated can UPDATE display_name');

-- Expected policies and the signup machinery exist.
select policies_are(
	'public', 'profiles',
	array['Profiles are viewable by everyone', 'Users can update own profile'],
	'profiles has exactly the expected RLS policies'
);
select has_trigger('auth', 'users', 'on_auth_user_created', 'signup trigger exists on auth.users');
select ok(
	(select prosecdef from pg_proc where oid = 'public.handle_new_user'::regproc),
	'handle_new_user runs as SECURITY DEFINER'
);

select * from finish();
rollback;
