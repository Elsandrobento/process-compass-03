
-- Install trigger on auth.users to create profile + default role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, nome, email, departamento)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  u.raw_user_meta_data->>'departamento'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill default 'criador' role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'criador'::public.app_role
FROM auth.users u
ON CONFLICT DO NOTHING;

-- Grant admin to the first registered user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;
