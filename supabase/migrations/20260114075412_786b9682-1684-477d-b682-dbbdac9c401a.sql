-- Add farm_id column to notifications table for farm-scoped notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES public.farms(id);

-- Create index for efficient farm-based queries  
CREATE INDEX IF NOT EXISTS idx_notifications_farm_id ON public.notifications(farm_id);

-- Update RLS policy to allow users to only see notifications for farms they belong to
-- or notifications with null farm_id (global notifications)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (
  auth.uid() = user_id 
  AND (
    farm_id IS NULL 
    OR farm_id IN (
      SELECT fm.farm_id FROM public.farm_memberships fm WHERE fm.user_id = auth.uid()
    )
  )
);