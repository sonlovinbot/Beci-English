-- Create listening_tests table to store generated tests and scores
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS listening_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_generation_id UUID REFERENCES audio_generations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  test_data JSONB NOT NULL,
  score_mc INTEGER,
  score_tf INTEGER,
  score_fill INTEGER,
  score_total INTEGER,
  score_max INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE listening_tests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own tests"
  ON listening_tests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tests"
  ON listening_tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tests"
  ON listening_tests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tests"
  ON listening_tests FOR DELETE
  USING (auth.uid() = user_id);
