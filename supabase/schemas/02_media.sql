-- Media: the user's uploaded library (ARCHITECTURE.md §4.2, ADR-0007/0012).
--
-- Bytes live in Cloudflare R2; this table stores only the server-generated key +
-- metadata (CLAUDE.md §4.9 — no raw media in Postgres). A row is born `pending`
-- (invisible) and is flipped to `approved`/`ready` only by the server-side
-- pipeline (consumer Worker / inline dev processor) using the service-role key —
-- never by a client. Clients therefore have NO insert/update/delete on media.

-- Shared content enums (ARCHITECTURE.md §4). Defined with their full documented
-- value sets even though Slice 2 only produces images: they are the canonical
-- types reused by posts/comments/messages in later slices.
create type public.media_kind as enum ('image', 'audio', 'video');
create type public.processing_state as enum ('pending', 'processing', 'ready', 'failed');
create type public.moderation_state as enum ('pending', 'approved', 'held', 'removed');

create table public.media (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references auth.users (id) on delete cascade,
	-- Server-generated R2 object key for the ORIGINAL upload (never the user filename).
	storage_key text not null unique,
	kind public.media_kind not null,
	-- Declared at upload, canonicalized to the re-encoded format by the pipeline.
	mime_type text not null,
	byte_size bigint not null check (byte_size >= 0),
	width integer check (width is null or width > 0),
	height integer check (height is null or height > 0),
	duration_ms integer check (duration_ms is null or duration_ms >= 0),
	-- sha256 of the safe (re-encoded) copy; set by the pipeline.
	checksum text,
	-- Derived object keys, e.g. {"safe":"<key>","thumb":"<key>"}. Never the original.
	variants jsonb not null default '{}'::jsonb,
	processing_state public.processing_state not null default 'pending',
	moderation_state public.moderation_state not null default 'pending',
	created_at timestamptz not null default now()
);

comment on table public.media is 'User media library; bytes in R2, references only here. pending/invisible until the pipeline approves.';

create index media_owner_created_idx on public.media (owner_id, created_at desc);
-- The public board reads approved+ready media newest-first.
create index media_board_idx on public.media (created_at desc)
	where moderation_state = 'approved' and processing_state = 'ready';

-- Row-Level Security: enable + default-deny, then explicit SELECT policies only.
alter table public.media enable row level security;

-- Public (incl. anonymous) may read media that cleared the pipeline.
create policy "Approved media is viewable by everyone" on public.media
	for select using (moderation_state = 'approved' and processing_state = 'ready');

-- An owner may read their own media in ANY state (to see processing/failed items).
create policy "Owners can view their own media" on public.media
	for select using ((select auth.uid()) = owner_id);

-- No client INSERT/UPDATE/DELETE policies on purpose: the row is created and its
-- state advanced only by the server pipeline via the service-role key, and removed
-- by the auth.users delete cascade (erasure of R2 objects is handled in Slice 9).

-- Column privileges: clients may read only NON-sensitive columns and may never
-- write. storage_key is server-internal and is NOT granted to client roles.
revoke all on public.media from anon, authenticated;
grant select (id, owner_id, kind, mime_type, width, height, duration_ms, variants, processing_state, moderation_state, created_at)
	on public.media to anon, authenticated;
-- service_role is the backend admin role (bypasses RLS); it performs all writes.
grant all on public.media to service_role;
