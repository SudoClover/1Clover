SET check_function_bodies = false;
CREATE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
	insert into public.profiles (id, username, birthdate)
	values (
		new.id,
		new.raw_user_meta_data ->> 'username',
		nullif(new.raw_user_meta_data ->> 'birthdate', '')::date
	);
	return new;
end;
$function$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TABLE public.profiles (id uuid NOT NULL, username text NOT NULL, display_name text, bio text, birthdate date, created_at timestamp with time zone DEFAULT now() NOT NULL);
COMMENT ON TABLE public.profiles IS 'Public user profile, one row per auth.users id. birthdate is private.';
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_check CHECK (bio IS NULL OR char_length(bio) <= 500);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_check CHECK (display_name IS NULL OR char_length(display_name) <= 50);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_check CHECK (username ~ '^[a-z0-9_]{3,30}$'::text);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
-- Start anon/authenticated from zero so only the explicit column grants below
-- apply (defends birthdate even if default privileges grant broad table access).
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (bio, created_at, display_name, id, username) ON public.profiles TO anon;
GRANT SELECT (bio, created_at, display_name, id, username) ON public.profiles TO authenticated;
GRANT UPDATE (bio, display_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));
