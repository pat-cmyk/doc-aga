-- Add logo_url column to farms table
ALTER TABLE public.farms 
ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.farms.logo_url IS 'URL to the farm logo image stored in the farm-logos bucket';

-- Create RLS policies for farm-logos storage bucket
CREATE POLICY "Farm logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'farm-logos');

CREATE POLICY "Farm owners and managers can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'farm-logos' 
  AND (
    EXISTS (
      SELECT 1 FROM public.farms
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.farm_memberships fm ON fm.farm_id = f.id
      JOIN public.user_roles ur ON ur.user_id = fm.user_id
      WHERE f.id::text = (storage.foldername(name))[1]
      AND fm.user_id = auth.uid()
      AND ur.role = 'farmer_owner'
      AND fm.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Farm owners and managers can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'farm-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.farms
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.farm_memberships fm ON fm.farm_id = f.id
      JOIN public.user_roles ur ON ur.user_id = fm.user_id
      WHERE f.id::text = (storage.foldername(name))[1]
      AND fm.user_id = auth.uid()
      AND ur.role = 'farmer_owner'
      AND fm.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Farm owners and managers can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'farm-logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.farms
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.farms f
      JOIN public.farm_memberships fm ON fm.farm_id = f.id
      JOIN public.user_roles ur ON ur.user_id = fm.user_id
      WHERE f.id::text = (storage.foldername(name))[1]
      AND fm.user_id = auth.uid()
      AND ur.role = 'farmer_owner'
      AND fm.invitation_status = 'accepted'
    )
  )
);