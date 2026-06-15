-- Fix RLS policies for profiles table
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create proper permissive policies with explicit auth checks
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix RLS policies for certificates table
-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;

-- Create proper permissive policy with explicit auth check
CREATE POLICY "Users can view their own certificates" 
ON public.certificates 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);