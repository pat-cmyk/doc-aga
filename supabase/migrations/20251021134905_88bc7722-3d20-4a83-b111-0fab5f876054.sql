-- Create voice_training_samples table
CREATE TABLE public.voice_training_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sample_text text NOT NULL,
  language text NOT NULL CHECK (language IN ('english', 'tagalog')),
  audio_url text NOT NULL,
  transcription text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_voice_samples_user ON public.voice_training_samples(user_id);

-- Enable RLS
ALTER TABLE public.voice_training_samples ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_training_samples
CREATE POLICY "Users can view their own voice samples"
  ON public.voice_training_samples
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice samples"
  ON public.voice_training_samples
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice samples"
  ON public.voice_training_samples
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add voice training columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS voice_training_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_training_skipped boolean DEFAULT false;

-- Create storage bucket for voice training samples
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-training-samples', 'voice-training-samples', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for voice training samples
CREATE POLICY "Users can upload their own voice training samples"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-training-samples' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own voice training samples"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'voice-training-samples' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own voice training samples"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'voice-training-samples' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );