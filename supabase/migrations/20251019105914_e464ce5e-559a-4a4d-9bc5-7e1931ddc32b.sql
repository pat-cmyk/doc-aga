-- Allow admins to view all Doc Aga queries from all users
CREATE POLICY "admins_view_all_queries"
ON doc_aga_queries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
);