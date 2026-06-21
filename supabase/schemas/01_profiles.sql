-- Profiles: one public profile per auth user (ARCHITECTURE.md §4.2).
--
-- A profile row is created automatically by a signup trigger. Public columns are
-- world-readable (anonymous browsing is allowed — ASSUMPTIONS.md). `birthdate` is
-- PRIVATE: collected at signup for the age gate (enforced in Slice 13) and never
-- exposed to, or editable by, client roles.

create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
	display_name text check (display_name is null or char_length(display_name) <= 50),
	bio text check (bio is null or char_length(bio) <= 500),
	birthdate date,
	created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public user profile, one row per auth.users id. birthdate is private.';

-- Row-Level Security: enable + default-deny, then explicit policies.
alter table public.profiles enable row level security;

-- Anyone (including anonymous visitors) may read profile rows.
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);

-- A user may update only their own profile row.
create policy "Users can update own profile" on public.profiles
	for update using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

-- No client INSERT/DELETE policies on purpose: rows are created by the signup
-- trigger below (SECURITY DEFINER) and removed by the auth.users delete cascade.

-- Column privileges: clients may read only PUBLIC columns, and change only
-- display_name + bio (never username, never the private birthdate). This is what
-- keeps birthdate unreadable by anon/authenticated even though rows are public.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, display_name, bio, created_at) on public.profiles to anon, authenticated;
grant update (display_name, bio) on public.profiles to authenticated;
-- service_role is the backend admin role (bypasses RLS); it keeps full access.
grant all on public.profiles to service_role;

-- Auto-create a profile when a new auth user is inserted. SECURITY DEFINER lets
-- it insert past RLS; empty search_path prevents search-path hijacking, so every
-- object below is fully qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id, username, birthdate)
	values (
		new.id,
		new.raw_user_meta_data ->> 'username',
		nullif(new.raw_user_meta_data ->> 'birthdate', '')::date
	);
	return new;
end;
$$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row
	execute function public.handle_new_user();
