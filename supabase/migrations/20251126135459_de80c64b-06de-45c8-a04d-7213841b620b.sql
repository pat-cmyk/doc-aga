-- Enable realtime for pending_activities table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_activities;