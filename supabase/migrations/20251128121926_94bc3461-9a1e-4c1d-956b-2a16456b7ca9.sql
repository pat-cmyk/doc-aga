-- Add activity notification types to the notification_type enum
ALTER TYPE notification_type ADD VALUE 'activity_approved';
ALTER TYPE notification_type ADD VALUE 'activity_rejected';