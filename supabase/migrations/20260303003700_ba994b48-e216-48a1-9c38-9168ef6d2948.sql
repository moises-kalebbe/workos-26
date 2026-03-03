
-- Fix function search_path for security
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.set_completed_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
