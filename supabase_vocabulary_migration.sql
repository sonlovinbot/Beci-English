-- Vocabulary module migration
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS user_vocabulary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Word data
  word TEXT NOT NULL,
  phonetic TEXT,
  part_of_speech TEXT,
  meaning_vi TEXT,
  example_en TEXT,
  example_vi TEXT,
  audio_url TEXT,
  image_url TEXT,

  -- Source
  source TEXT NOT NULL DEFAULT 'manual',
  -- 'oxford3000' | 'ielts3000' | 'ocr' | 'manual'

  -- Spaced Repetition (1..5)
  srs_level INTEGER NOT NULL DEFAULT 1,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_user_vocab_user ON user_vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocab_due ON user_vocabulary(user_id, next_review_at);

ALTER TABLE user_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vocabulary"
  ON user_vocabulary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary"
  ON user_vocabulary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocabulary"
  ON user_vocabulary FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocabulary"
  ON user_vocabulary FOR DELETE
  USING (auth.uid() = user_id);
