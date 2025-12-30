CREATE POLICY "users_delete_own_notifications" ON "public"."notifications"
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);