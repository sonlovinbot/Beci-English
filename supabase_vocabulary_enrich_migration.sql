-- Add English-language enrichment fields to user_vocabulary
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS meaning_en TEXT,
  ADD COLUMN IF NOT EXISTS synonyms TEXT[],
  ADD COLUMN IF NOT EXISTS antonyms TEXT[];
