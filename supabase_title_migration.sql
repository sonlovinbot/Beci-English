-- Add title column to audio_generations table
ALTER TABLE audio_generations
ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled Lesson';
