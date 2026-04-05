-- Add missing UPDATE policy for audio_generations
-- Run this in Supabase Dashboard > SQL Editor
CREATE POLICY "Users can update own data"
  ON audio_generations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
