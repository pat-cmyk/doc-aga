-- Allow farmhands to update their own pending submissions (only while status is 'pending' or 'rejected' for resubmit)
CREATE POLICY "farmhands_update_own_pending"
ON public.pending_activities
FOR UPDATE
TO authenticated
USING (
  submitted_by = auth.uid() 
  AND status IN ('pending', 'rejected')
)
WITH CHECK (
  submitted_by = auth.uid() 
  AND status IN ('pending', 'rejected')
);