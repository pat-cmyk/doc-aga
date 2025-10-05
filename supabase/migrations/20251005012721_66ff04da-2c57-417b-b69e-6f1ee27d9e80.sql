-- Add missing notification_type enum value
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_received';