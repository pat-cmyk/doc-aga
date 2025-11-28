-- Add foreign key from submitted_by to profiles.id
ALTER TABLE public.pending_activities 
ADD CONSTRAINT fk_pending_activities_submitted_by_profiles 
FOREIGN KEY (submitted_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key from reviewed_by to profiles.id
ALTER TABLE public.pending_activities 
ADD CONSTRAINT fk_pending_activities_reviewed_by_profiles 
FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;