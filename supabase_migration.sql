-- =============================================
-- BECI English - Supabase Migration
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Table: audio_generations
CREATE TABLE audio_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  voice TEXT NOT NULL DEFAULT 'Kore',
  style TEXT DEFAULT '',
  audio_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE audio_generations ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (anonymous access - no auth)
CREATE POLICY "anon_select" ON audio_generations FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON audio_generations FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_delete" ON audio_generations FOR DELETE USING (true);

-- 4. Create Storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true);

-- 5. Storage RLS Policies
CREATE POLICY "audio_anon_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio');
CREATE POLICY "audio_anon_read" ON storage.objects FOR SELECT USING (bucket_id = 'audio');
CREATE POLICY "audio_anon_delete" ON storage.objects FOR DELETE USING (bucket_id = 'audio');
