-- Schedule the daily stats calculation to run every day at 1 AM UTC
SELECT cron.schedule(
  'daily-farm-stats-calculation',
  '0 1 * * *', -- Run at 1 AM UTC every day
  $$
  SELECT
    net.http_post(
        url:='https://sxorybjlxyquxteptdyk.supabase.co/functions/v1/calculate-daily-stats',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4b3J5YmpseHlxdXh0ZXB0ZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjQ3ODUsImV4cCI6MjA3NDc0MDc4NX0.WalyDDm7YNNcdiZrrB3PfMUpD2Qj8ld-9SWMv5lB1cA"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);