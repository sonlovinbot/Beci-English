-- =============================================
-- BECI English - Auth Migration
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Add user_id column to audio_generations
ALTER TABLE audio_generations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Drop old anonymous RLS policies
DROP POLICY IF EXISTS "anon_select" ON audio_generations;
DROP POLICY IF EXISTS "anon_insert" ON audio_generations;
DROP POLICY IF EXISTS "anon_delete" ON audio_generations;

-- 3. Create user-scoped RLS policies
CREATE POLICY "Users can read own data"
  ON audio_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON audio_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON audio_generations FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Update storage policies for user-scoped access
DROP POLICY IF EXISTS "audio_anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "audio_anon_read" ON storage.objects;
DROP POLICY IF EXISTS "audio_anon_delete" ON storage.objects;

CREATE POLICY "Users can upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio' AND auth.role() = 'authenticated');

CREATE POLICY "Users can read audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio' AND auth.role() = 'authenticated');
