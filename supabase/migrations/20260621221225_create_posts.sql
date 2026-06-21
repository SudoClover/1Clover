SET check_function_bodies = false;
CREATE FUNCTION public.stamp_post_edited()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
	new.edited_at := now();
	return new;
end;
$function$;
CREATE TABLE public.post_media (post_id uuid NOT NULL, media_id uuid NOT NULL, "position" smallint DEFAULT 0 NOT NULL);
COMMENT ON TABLE public.post_media IS 'Ordered many-to-many between posts and media; media is reusable across posts.';
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ADD CONSTRAINT post_media_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;
ALTER TABLE public.post_media ADD CONSTRAINT post_media_pkey PRIMARY KEY (post_id, media_id);
ALTER TABLE public.post_media ADD CONSTRAINT post_media_position_check CHECK ("position" >= 0);
-- Start anon/authenticated from zero so ONLY the explicit column grants below apply
-- (the diff tool drops this; Supabase default privileges otherwise grant broad access).
REVOKE ALL ON public.post_media FROM anon, authenticated;
GRANT SELECT ("position", media_id, post_id) ON public.post_media TO anon;
GRANT DELETE ON public.post_media TO authenticated;
GRANT INSERT, SELECT ("position", media_id, post_id) ON public.post_media TO authenticated;
GRANT UPDATE ("position") ON public.post_media TO authenticated;
GRANT ALL ON public.post_media TO service_role;
CREATE INDEX post_media_post_idx ON public.post_media (post_id, "position");
CREATE INDEX post_media_media_idx ON public.post_media (media_id);
CREATE TABLE public.posts (id uuid DEFAULT gen_random_uuid() NOT NULL, author_id uuid NOT NULL, title text NOT NULL, description text, moderation_state public.moderation_state DEFAULT 'approved'::public.moderation_state NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, edited_at timestamp with time zone);
CREATE POLICY "Authors can link their own media to their posts" ON public.post_media FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_media.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.media m
  WHERE ((m.id = post_media.media_id) AND (m.owner_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "Authors can reorder media on their posts" ON public.post_media FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_media.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_media.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Authors can unlink media from their posts" ON public.post_media FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_media.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Post media is viewable when the post is" ON public.post_media FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_media.post_id) AND ((p.moderation_state = 'approved'::public.moderation_state) OR (( SELECT auth.uid() AS uid) = p.author_id))))));
COMMENT ON TABLE public.posts IS 'A published post: title/description wrapping 1..n media. Owner-writable; moderation_state is server-only.';
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_description_check CHECK (description IS NULL OR char_length(description) <= 2000);
ALTER TABLE public.posts ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE public.post_media ADD CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_title_check CHECK (char_length(title) >= 1 AND char_length(title) <= 140);
-- Start from zero so clients get only title/description writes — NEVER
-- moderation_state/edited_at (prevents a user un-holding their own post). The diff
-- tool drops this REVOKE; it is security-critical here.
REVOKE ALL ON public.posts FROM anon, authenticated;
GRANT SELECT (author_id, created_at, description, edited_at, id, moderation_state, title) ON public.posts TO anon;
GRANT DELETE ON public.posts TO authenticated;
GRANT INSERT (author_id, description, title) ON public.posts TO authenticated;
GRANT SELECT (author_id, created_at, description, edited_at, id, moderation_state, title) ON public.posts TO authenticated;
GRANT UPDATE (description, title) ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
CREATE INDEX posts_board_idx ON public.posts (created_at DESC, id DESC) WHERE moderation_state = 'approved'::public.moderation_state;
CREATE INDEX posts_author_idx ON public.posts (author_id, created_at DESC);
CREATE TRIGGER posts_set_edited BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.stamp_post_edited();
CREATE POLICY "Approved posts are viewable by everyone" ON public.posts FOR SELECT USING ((moderation_state = 'approved'::public.moderation_state));
CREATE POLICY "Authors can create their own posts" ON public.posts FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = author_id));
CREATE POLICY "Authors can delete their own posts" ON public.posts FOR DELETE USING ((( SELECT auth.uid() AS uid) = author_id));
CREATE POLICY "Authors can update their own posts" ON public.posts FOR UPDATE USING ((( SELECT auth.uid() AS uid) = author_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = author_id));
CREATE POLICY "Authors can view their own posts" ON public.posts FOR SELECT USING ((( SELECT auth.uid() AS uid) = author_id));
-- Atomic create: post + its media links in one transaction, SECURITY INVOKER so RLS
-- still enforces ownership. author_id comes from auth.uid(), never a client argument.
CREATE FUNCTION public.create_post(p_title text, p_description text, p_media_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
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
$function$;
-- The diff tool emits the default PUBLIC execute grant; lock it to signed-in users.
REVOKE EXECUTE ON FUNCTION public.create_post(text, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_post(text, text, uuid[]) TO authenticated;
