CREATE TYPE public.media_kind AS ENUM ('image', 'audio', 'video');
CREATE TYPE public.moderation_state AS ENUM ('pending', 'approved', 'held', 'removed');
CREATE TYPE public.processing_state AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TABLE public.media (id uuid DEFAULT gen_random_uuid() NOT NULL, owner_id uuid NOT NULL, storage_key text NOT NULL, kind public.media_kind NOT NULL, mime_type text NOT NULL, byte_size bigint NOT NULL, width integer, height integer, duration_ms integer, checksum text, variants jsonb DEFAULT '{}'::jsonb NOT NULL, processing_state public.processing_state DEFAULT 'pending'::public.processing_state NOT NULL, moderation_state public.moderation_state DEFAULT 'pending'::public.moderation_state NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
COMMENT ON TABLE public.media IS 'User media library; bytes in R2, references only here. pending/invisible until the pipeline approves.';
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ADD CONSTRAINT media_byte_size_check CHECK (byte_size >= 0);
ALTER TABLE public.media ADD CONSTRAINT media_duration_ms_check CHECK (duration_ms IS NULL OR duration_ms >= 0);
ALTER TABLE public.media ADD CONSTRAINT media_height_check CHECK (height IS NULL OR height > 0);
ALTER TABLE public.media ADD CONSTRAINT media_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.media ADD CONSTRAINT media_pkey PRIMARY KEY (id);
ALTER TABLE public.media ADD CONSTRAINT media_storage_key_key UNIQUE (storage_key);
ALTER TABLE public.media ADD CONSTRAINT media_width_check CHECK (width IS NULL OR width > 0);
-- Start anon/authenticated from zero so only the explicit column grants below
-- apply (hides storage_key/checksum/byte_size even if default privileges grant
-- broad table access) and clients keep NO write privilege on media.
REVOKE ALL ON public.media FROM anon, authenticated;
GRANT SELECT (created_at, duration_ms, height, id, kind, mime_type, moderation_state, owner_id, processing_state, variants, width) ON public.media TO anon;
GRANT SELECT (created_at, duration_ms, height, id, kind, mime_type, moderation_state, owner_id, processing_state, variants, width) ON public.media TO authenticated;
GRANT ALL ON public.media TO service_role;
CREATE INDEX media_board_idx ON public.media (created_at DESC) WHERE moderation_state = 'approved'::public.moderation_state AND processing_state = 'ready'::public.processing_state;
CREATE INDEX media_owner_created_idx ON public.media (owner_id, created_at DESC);
CREATE POLICY "Approved media is viewable by everyone" ON public.media FOR SELECT USING (((moderation_state = 'approved'::public.moderation_state) AND (processing_state = 'ready'::public.processing_state)));
CREATE POLICY "Owners can view their own media" ON public.media FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));
