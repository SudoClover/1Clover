-- Tags & post_tags (ARCHITECTURE.md §4.2 — Slice 4). A tag is a small global label;
-- `post_tags` is the many-to-many between posts and tags. Tags are SHARED: the same
-- `tags` row is reused across posts and authors, which is what makes "similar posts"
-- (tag overlap) work. Like `post_media`, a client may link tags only to a post it owns.
--
-- No `posts.metadata` column this slice (overseer decision): similarity is tag overlap
-- only. The pure `findSimilar` interface stays stable so metadata/pgvector slot in later.

-- A tag name is normalized client-side (lower, [a-z0-9-], ≤30); this CHECK is the
-- DB-level backstop so a bypassed server layer still can't write garbage.
create table public.tags (
	id uuid primary key default gen_random_uuid(),
	name text not null unique check (name ~ '^[a-z0-9-]{1,30}$'),
	created_at timestamptz not null default now()
);

comment on table public.tags is 'A global, reusable label. Shared across posts/authors; that sharing is what powers tag-overlap similarity.';

alter table public.tags enable row level security;

-- Tags are public to read; any signed-in user may introduce a new tag (the CHECK keeps
-- it well-formed). Clients never update or delete tags (a moderator/service_role can).
create policy "Tags are viewable by everyone" on public.tags
	for select using (true);
create policy "Authenticated users can create tags" on public.tags
	for insert with check ((select auth.uid()) is not null);

revoke all on public.tags from anon, authenticated;
grant select (id, name, created_at) on public.tags to anon, authenticated;
grant insert (name) on public.tags to authenticated;
grant all on public.tags to service_role;

-- ── post_tags: links a post to its tags ─────────────────────────────────────
create table public.post_tags (
	post_id uuid not null references public.posts (id) on delete cascade,
	tag_id uuid not null references public.tags (id) on delete cascade,
	primary key (post_id, tag_id)
);

comment on table public.post_tags is 'Many-to-many between posts and tags; the author of the post owns the links.';

-- (tag_id, post_id) drives the similar-posts lookup ("other posts carrying this tag");
-- the PK already indexes (post_id, tag_id) for "this post's tags".
create index post_tags_tag_idx on public.post_tags (tag_id, post_id);

alter table public.post_tags enable row level security;

-- A link is readable whenever its parent post is readable by the viewer (mirrors
-- post_media): approved to everyone, plus the author for their own non-approved posts.
create policy "Post tags are viewable when the post is" on public.post_tags
	for select using (
		exists (
			select 1 from public.posts p
			where p.id = post_id
				and (p.moderation_state = 'approved' or (select auth.uid()) = p.author_id)
		)
	);

-- Only the post's author may tag or untag it.
create policy "Authors can tag their own posts" on public.post_tags
	for insert with check (
		exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
	);
create policy "Authors can untag their own posts" on public.post_tags
	for delete using (
		exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
	);

revoke all on public.post_tags from anon, authenticated;
grant select (post_id, tag_id) on public.post_tags to anon, authenticated;
grant insert (post_id, tag_id) on public.post_tags to authenticated;
grant delete on public.post_tags to authenticated;
grant all on public.post_tags to service_role;

-- ── set_post_tags: replace a post's tags atomically ─────────────────────────
-- Get-or-create each tag, then swap the post's links to exactly p_tag_names — all in one
-- transaction. SECURITY INVOKER (not definer): runs with the caller's RLS, and an explicit
-- owner check fails a non-owner fast (so we never create orphan tag rows on their behalf).
-- Names arrive already normalized from the server layer; the tags CHECK is the backstop.
create or replace function public.set_post_tags(p_post_id uuid, p_tag_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_names text[] := coalesce(p_tag_names, '{}');
begin
	if not exists (
		select 1 from public.posts
		where id = p_post_id and author_id = (select auth.uid())
	) then
		raise exception 'only the post owner can set its tags'
			using errcode = 'insufficient_privilege';
	end if;

	insert into public.tags (name)
		select distinct unnest(v_names)
		on conflict (name) do nothing;

	delete from public.post_tags where post_id = p_post_id;

	insert into public.post_tags (post_id, tag_id)
		select p_post_id, t.id from public.tags t where t.name = any (v_names);
end;
$$;

-- Default EXECUTE is granted to PUBLIC on create — revoke it, then allow only signed-in users.
revoke execute on function public.set_post_tags(uuid, text[]) from public;
grant execute on function public.set_post_tags(uuid, text[]) to authenticated;
