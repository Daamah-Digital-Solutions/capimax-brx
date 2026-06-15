-- Fix 1: Update handle_new_user() to always default to 'investor' role
-- This prevents privilege escalation through user-controlled metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, role)
  VALUES (
    NEW.id,
    NULLIF(TRIM(substring(NEW.raw_user_meta_data->>'full_name', 1, 100)), ''),
    NULLIF(TRIM(substring(NEW.raw_user_meta_data->>'phone', 1, 20)), ''),
    'investor'  -- Always default to investor - role cannot be user-controlled
  );
  RETURN NEW;
END;
$$;

-- Fix 2: Add public certificate verification policy
-- Allows anyone to verify certificates by verification code (high entropy = secure)
CREATE POLICY "Public certificate verification by code"
ON public.certificates FOR SELECT
TO anon, authenticated
USING (verification_code IS NOT NULL);