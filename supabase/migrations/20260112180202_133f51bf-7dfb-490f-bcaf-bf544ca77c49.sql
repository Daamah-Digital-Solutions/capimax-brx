-- Remove trigger from auth schema (avoid triggers on reserved schemas)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove the now-unused helper
DROP FUNCTION IF EXISTS public.handle_new_user();