-- Enable realtime for health_records and milking_records tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.health_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.milking_records;