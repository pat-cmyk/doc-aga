-- Create platform_settings table for global configuration
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

-- Only super admins can update settings
CREATE POLICY "Super admins can update platform settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Only super admins can insert settings (for initial setup)
CREATE POLICY "Super admins can insert platform settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

-- Insert default backdating setting: enforcement OFF during acquisition phase
INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES ('backdating', '{"enabled": false, "max_days": 7}'::jsonb);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;