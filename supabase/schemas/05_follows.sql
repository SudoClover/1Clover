-- Follows (ARCHITECTURE.md §4.2 — Slice 5). One-way follow edges that drive the
-- Following feed. Introduced MINIMALLY here: read-only from the client (a user reads
-- their own edges). The follow/unfollow BUTTON, write policies, and friendships arrive
-- in Slice 10 — see ROADMAP.md. Seeded via service-role in tests until then.

create table public.follows (
	follower_id uuid not null references auth.users (id) on delete cascade,
	followee_id uuid not null references auth.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (follower_id, followee_id),
	check (follower_id <> followee_id)
);

comment on table public.follows is 'One-way follow edges; drives the Following feed. Read-only from clients until Slice 10 adds the follow button + write policies.';

-- The PK (follower_id, followee_id) already indexes the "who do I follow" lookup the
-- Following feed needs. Reverse-direction indexes wait for Slice 10 (follower lists).

alter table public.follows enable row level security;

-- A user may read only their own outgoing follow edges (no client writes yet).
create policy "Users can view their own follows" on public.follows
	for select using ((select auth.uid()) = follower_id);

-- Read-only for signed-in users; no anon access (the Following feed requires sign-in).
-- INSERT/UPDATE/DELETE grants + policies arrive with the follow button (Slice 10).
revoke all on public.follows from anon, authenticated;
grant select (follower_id, followee_id, created_at) on public.follows to authenticated;
grant all on public.follows to service_role;
