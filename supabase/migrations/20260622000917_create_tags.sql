SET check_function_bodies = false;

-- set_post_tags: get-or-create each tag then swap a post's links, all in one transaction
-- (see supabase/schemas/04_tags.sql). SECURITY INVOKER + an explicit owner check.
CREATE FUNCTION public.set_post_tags(p_post_id uuid, p_tag_names text[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;
-- The diff tool drops the default PUBLIC execute revoke; it is security-critical (otherwise
-- anon could invoke set_post_tags).
REVOKE EXECUTE ON FUNCTION public.set_post_tags(uuid, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_post_tags(uuid, text[]) TO authenticated;

-- ── tags ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.tags (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
COMMENT ON TABLE public.tags IS 'A global, reusable label. Shared across posts/authors; that sharing is what powers tag-overlap similarity.';
ALTER TABLE public.tags ADD CONSTRAINT tags_pkey PRIMARY KEY (id);
ALTER TABLE public.tags ADD CONSTRAINT tags_name_key UNIQUE (name);
ALTER TABLE public.tags ADD CONSTRAINT tags_name_check CHECK (name ~ '^[a-z0-9-]{1,30}$'::text);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- The diff tool drops this REVOKE; it is security-critical (default privileges otherwise
-- grant anon/authenticated full table access, defeating the column grants below).
REVOKE ALL ON public.tags FROM anon, authenticated;
GRANT SELECT (created_at, id, name) ON public.tags TO anon;
GRANT SELECT (created_at, id, name) ON public.tags TO authenticated;
GRANT INSERT (name) ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;

CREATE POLICY "Tags are viewable by everyone" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tags" ON public.tags FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

-- ── post_tags ─────────────────────────────────────────────────────────────────
CREATE TABLE public.post_tags (post_id uuid NOT NULL, tag_id uuid NOT NULL);
COMMENT ON TABLE public.post_tags IS 'Many-to-many between posts and tags; the author of the post owns the links.';
ALTER TABLE public.post_tags ADD CONSTRAINT post_tags_pkey PRIMARY KEY (post_id, tag_id);
ALTER TABLE public.post_tags ADD CONSTRAINT post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_tags ADD CONSTRAINT post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
CREATE INDEX post_tags_tag_idx ON public.post_tags (tag_id, post_id);
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

-- Same security-critical REVOKE the diff tool drops.
REVOKE ALL ON public.post_tags FROM anon, authenticated;
GRANT SELECT (post_id, tag_id) ON public.post_tags TO anon;
GRANT SELECT (post_id, tag_id) ON public.post_tags TO authenticated;
GRANT INSERT (post_id, tag_id) ON public.post_tags TO authenticated;
GRANT DELETE ON public.post_tags TO authenticated;
GRANT ALL ON public.post_tags TO service_role;

CREATE POLICY "Post tags are viewable when the post is" ON public.post_tags FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_tags.post_id) AND ((p.moderation_state = 'approved'::public.moderation_state) OR (( SELECT auth.uid() AS uid) = p.author_id))))));
CREATE POLICY "Authors can tag their own posts" ON public.post_tags FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_tags.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Authors can untag their own posts" ON public.post_tags FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = post_tags.post_id) AND (p.author_id = ( SELECT auth.uid() AS uid))))));
