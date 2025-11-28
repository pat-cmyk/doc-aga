-- Allow farmhands to delete their own pending submissions
CREATE POLICY "farmhands_delete_own_pending" ON pending_activities
FOR DELETE
USING (
  submitted_by = auth.uid() 
  AND status = 'pending'
);