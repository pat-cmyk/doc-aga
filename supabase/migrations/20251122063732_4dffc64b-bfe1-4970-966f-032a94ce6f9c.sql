-- Create ENUMs for farmer feedback system
CREATE TYPE feedback_category AS ENUM (
  'policy_concern',
  'market_access',
  'veterinary_support',
  'training_request',
  'infrastructure',
  'financial_assistance',
  'emergency_support',
  'disease_outbreak',
  'feed_shortage'
);

CREATE TYPE feedback_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

CREATE TYPE feedback_status AS ENUM (
  'submitted',
  'acknowledged',
  'under_review',
  'action_taken',
  'resolved',
  'closed'
);

CREATE TYPE feedback_sentiment AS ENUM (
  'urgent',
  'negative',
  'neutral',
  'positive'
);

-- Create farmer_feedback table
CREATE TABLE public.farmer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Voice and text content
  voice_audio_url TEXT,
  transcription TEXT NOT NULL,
  ai_summary TEXT,
  
  -- AI-powered categorization
  primary_category feedback_category NOT NULL,
  secondary_categories feedback_category[],
  tags TEXT[],
  
  -- AI analysis
  sentiment feedback_sentiment NOT NULL DEFAULT 'neutral',
  priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
  auto_priority feedback_priority NOT NULL DEFAULT 'medium',
  detected_entities JSONB DEFAULT '{}',
  
  -- Status tracking
  status feedback_status NOT NULL DEFAULT 'submitted',
  assigned_department TEXT,
  government_notes TEXT,
  action_taken TEXT,
  resolution_date TIMESTAMP WITH TIME ZONE,
  
  -- Privacy
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  
  -- Farm context snapshot for government insights
  farm_snapshot JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_farmer_feedback_farm_id ON public.farmer_feedback(farm_id);
CREATE INDEX idx_farmer_feedback_user_id ON public.farmer_feedback(user_id);
CREATE INDEX idx_farmer_feedback_status ON public.farmer_feedback(status);
CREATE INDEX idx_farmer_feedback_priority ON public.farmer_feedback(auto_priority);
CREATE INDEX idx_farmer_feedback_category ON public.farmer_feedback(primary_category);
CREATE INDEX idx_farmer_feedback_created_at ON public.farmer_feedback(created_at DESC);
CREATE INDEX idx_farmer_feedback_priority_score ON public.farmer_feedback(priority_score DESC);
CREATE INDEX idx_farmer_feedback_tags ON public.farmer_feedback USING GIN(tags);

-- Enable RLS
ALTER TABLE public.farmer_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Farmers can view their own submissions
CREATE POLICY "Farmers can view own feedback"
  ON public.farmer_feedback
  FOR SELECT
  USING (auth.uid() = user_id OR can_access_farm(farm_id));

-- Farmers can insert feedback
CREATE POLICY "Farmers can submit feedback"
  ON public.farmer_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND can_access_farm(farm_id));

-- Farmers can update their own pending submissions
CREATE POLICY "Farmers can update own pending feedback"
  ON public.farmer_feedback
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'submitted');

-- Government and admins can view all feedback
CREATE POLICY "Government can view all feedback"
  ON public.farmer_feedback
  FOR SELECT
  USING (has_government_access(auth.uid()));

-- Government and admins can update feedback (status, notes, actions)
CREATE POLICY "Government can update feedback"
  ON public.farmer_feedback
  FOR UPDATE
  USING (has_government_access(auth.uid()));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_farmer_feedback_updated_at
  BEFORE UPDATE ON public.farmer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_timestamp();