-- Add conversation tracking columns to doc_aga_queries
ALTER TABLE doc_aga_queries 
ADD COLUMN IF NOT EXISTS conversation_id uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS message_index integer DEFAULT 0;

-- Create index for efficient conversation lookups
CREATE INDEX IF NOT EXISTS idx_doc_aga_queries_conversation 
ON doc_aga_queries(user_id, conversation_id, created_at DESC);

-- Create index for recent context lookups by user
CREATE INDEX IF NOT EXISTS idx_doc_aga_queries_user_recent 
ON doc_aga_queries(user_id, created_at DESC);