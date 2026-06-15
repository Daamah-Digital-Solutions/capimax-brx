-- Create PWA settings table for admin control
CREATE TABLE public.pwa_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Capimax RT',
  app_short_name TEXT NOT NULL DEFAULT 'Capimax',
  app_description TEXT NOT NULL DEFAULT 'Real Estate Tokenization Platform',
  theme_color TEXT NOT NULL DEFAULT '#1a365d',
  background_color TEXT NOT NULL DEFAULT '#ffffff',
  install_prompt_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.pwa_settings (app_name, app_short_name, app_description)
VALUES ('Capimax RT', 'Capimax', 'Real Estate Tokenization Platform');

-- Enable RLS
ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read PWA settings (needed for the app to function)
CREATE POLICY "Anyone can read PWA settings"
ON public.pwa_settings
FOR SELECT
USING (true);

-- Only authenticated users with admin role can update settings
CREATE POLICY "Admins can update PWA settings"
ON public.pwa_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_pwa_settings_updated_at
BEFORE UPDATE ON public.pwa_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();