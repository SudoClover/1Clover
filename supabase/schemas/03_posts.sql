-- Posts & post_media (ARCHITECTURE.md §4.2). A post is a title/description wrapping
-- 1..n library media; `post_media` is the ordered join. These are the first
-- CLIENT-WRITABLE tables: an author creates/edits/deletes their OWN rows via RLS.
--
-- `posts.moderation_state` defaults to 'approved' — post text is moderated reactively
-- (reports/queue, Slice 8); the proactively gated payload is media (Slice 2). Clients
-- cannot set or change `moderation_state` (no column grant), so a user can never
-- self-approve or self-un-hold; a moderator (service_role/Slice 8) can hold/remove.

create table public.posts (
	id uuid primary key default gen_random_uuid(),
	author_id uuid not null references auth.users (id) on delete cascade,
	title text not null check (char_length(title) between 1 and 140),
	description text check (description is null or char_length(description) <= 2000),
	moderation_state public.moderation_state not null default 'approved',
	created_at timestamptz not null default now(),
	edited_at timestamptz,
	-- Server-computed "hot" rank (Slice 5). Set by a trigger, never by clients (no column
	-- grant), so the feed can't be skewed. See set_post_hot_score below.
	hot_score double precision not null default 0
);

comment on table public.posts is 'A published post: title/description wrapping 1..n media. Owner-writable; moderation_state is server-only.';

-- Keyset board pagination: newest-first, (created_at, id) as the cursor.
create index posts_board_idx on public.posts (created_at desc, id desc) where moderation_state = 'approved';
create index posts_author_idx on public.posts (author_id, created_at desc);
-- Keyset Hot feed: highest hot_score first, (hot_score, id) as the cursor.
create index posts_hot_idx on public.posts (hot_score desc, id desc) where moderation_state = 'approved';

alter table public.posts enable row level security;

-- Anyone may read approved posts; an author also reads their own in any state.
create policy "Approved posts are viewable by everyone" on public.posts
	for select using (moderation_state = 'approved');
create policy "Authors can view their own posts" on public.posts
	for select using ((select auth.uid()) = author_id);

-- An author creates/edits/deletes only their own posts.
create policy "Authors can create their own posts" on public.posts
	for insert with check ((select auth.uid()) = author_id);
create policy "Authors can update their own posts" on public.posts
	for update using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "Authors can delete their own posts" on public.posts
	for delete using ((select auth.uid()) = author_id);

-- `edited_at` is stamped server-side on every update; clients cannot set it.
create or replace function public.stamp_post_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.edited_at := now();
	return new;
end;
$$;

create trigger posts_set_edited before update on public.posts
	for each row execute function public.stamp_post_edited();

-- `hot_score` is server-computed (clients have no grant on it). Reddit-style rank: a
-- popularity term (log10 of the score) + an absolute-time term. Scores arrive with
-- ratings (Slice 6); until then the score is 0, so this is the time term alone and Hot
-- mirrors New. Mirrors the pure spec in src/lib/domain/feed/hot-score.ts (45000 divisor),
-- with an integration test asserting they agree. Set on insert; Slice 6 recomputes on
-- rating change.
create or replace function public.set_post_hot_score()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.hot_score := extract(epoch from coalesce(new.created_at, now())) / 45000;
	return new;
end;
$$;

create trigger posts_set_hot_score before insert on public.posts
	for each row execute function public.set_post_hot_score();

-- hot_feed_page: one ordered keyset page of approved post ids for the Hot feed. The
-- cursor is the LAST id of the previous page; the boundary's (hot_score, id) is resolved
-- HERE, in SQL, so hot_score never round-trips through the client (PostgREST truncates
-- float8, which would dup/skip rows at page edges). SECURITY INVOKER → RLS still applies;
-- Hot is public, so anon/authenticated may execute.
-- Trade-off: if the cursor post is deleted/held mid-scroll, the boundary CTE is empty and
-- the next page returns empty (pagination ends early until refresh) — no dup/skip, accepted.
create or replace function public.hot_feed_page(p_limit integer, p_cursor_id uuid default null)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
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
$$;

-- Default EXECUTE is granted to PUBLIC on create — revoke it, then allow everyone who can
-- read the public board (anon + signed-in users).
revoke execute on function public.hot_feed_page(integer, uuid) from public;
grant execute on function public.hot_feed_page(integer, uuid) to anon, authenticated;

-- Column privileges: clients read public columns and may write only title/description
-- (+ author_id on insert, pinned to self by the policy). Never moderation_state/edited_at.
revoke all on public.posts from anon, authenticated;
grant select (id, author_id, title, description, moderation_state, created_at, edited_at, hot_score)
	on public.posts to anon, authenticated;
grant insert (author_id, title, description) on public.posts to authenticated;
grant update (title, description) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant all on public.posts to service_role;

-- ── post_media: ordered links from a post to library media ──────────────────
create table public.post_media (
	post_id uuid not null references public.posts (id) on delete cascade,
	media_id uuid not null references public.media (id) on delete cascade,
	position smallint not null default 0 check (position >= 0),
	primary key (post_id, media_id)
);

comment on table public.post_media is 'Ordered many-to-many between posts and media; media is reusable across posts.';

create index post_media_post_idx on public.post_media (post_id, position);
create index post_media_media_idx on public.post_media (media_id);

alter table public.post_media enable row level security;

-- A link is readable when its parent post is readable by the viewer.
create policy "Post media is viewable when the post is" on public.post_media
	for select using (
		exists (
			select 1 from public.posts p
			where p.id = post_id
				and (p.moderation_state = 'approved' or (select auth.uid()) = p.author_id)
		)
	);

-- Only the post's author may link media, and only media they own.
create policy "Authors can link their own media to their posts" on public.post_media
	for insert with check (
		exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
		and exists (select 1 from public.media m where m.id = media_id and m.owner_id = (select auth.uid()))
	);
create policy "Authors can reorder media on their posts" on public.post_media
	for update using (
		exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
	) with check (
		exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
	);
create policy "Authors can unlink media from their posts" on public.post_media
	for delete using (
		exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
	);

revoke all on public.post_media from anon, authenticated;
grant select (post_id, media_id, position) on public.post_media to anon, authenticated;
grant insert (post_id, media_id, position) on public.post_media to authenticated;
grant update (position) on public.post_media to authenticated;
grant delete on public.post_media to authenticated;
grant all on public.post_media to service_role;

-- ── create_post: atomic "post + its media links" in one transaction ─────────
-- A post is meaningless without its media, so both inserts must succeed together.
-- SECURITY INVOKER (not definer): the function runs with the caller's privileges and
-- RLS, so ownership is still enforced by the posts/post_media policies — linking a
-- media you don't own raises and rolls the whole post back. author_id is taken from
-- the verified auth.uid(), never from a client argument.
create or replace function public.create_post(
	p_title text,
	p_description text,
	p_media_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_post_id uuid;
	v_media_id uuid;
	v_position smallint := 0;
begin
	if p_media_ids is null or array_length(p_media_ids, 1) is null then
		raise exception 'a post needs at least one media item'
			using errcode = 'check_violation';
	end if;

	insert into public.posts (author_id, title, description)
		values ((select auth.uid()), p_title, nullif(p_description, ''))
		returning id into v_post_id;

	foreach v_media_id in array p_media_ids loop
		insert into public.post_media (post_id, media_id, position)
			values (v_post_id, v_media_id, v_position);
		v_position := v_position + 1;
	end loop;

	return v_post_id;
end;
$$;

-- Default EXECUTE is granted to PUBLIC on create — revoke it, then allow only signed-in users.
revoke execute on function public.create_post(text, text, uuid[]) from public;
grant execute on function public.create_post(text, text, uuid[]) to authenticated;
