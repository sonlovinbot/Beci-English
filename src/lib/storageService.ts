import { supabase } from './supabase';
import { pcmBase64ToWavBlob } from './audioUtils';

export interface AudioGeneration {
  id: string;
  text: string;
  voice: string;
  style: string;
  audio_storage_path: string | null;
  user_id: string | null;
  created_at: string;
}

/**
 * Save a new audio generation to Supabase (DB + Storage).
 */
export async function saveGeneration(
  text: string,
  voice: string,
  style: string,
  base64Audio: string
): Promise<AudioGeneration | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user');
      return null;
    }

    // 1. Convert base64 PCM to WAV blob for storage
    const wavBlob = pcmBase64ToWavBlob(base64Audio);
    const fileName = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`;
    const storagePath = `${user.id}/${fileName}`;

    // 2. Upload WAV to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(storagePath, wavBlob, {
        contentType: 'audio/wav',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
    }

    // 3. Insert row into database
    const { data, error: dbError } = await supabase
      .from('audio_generations')
      .insert({
        text,
        voice,
        style,
        audio_storage_path: uploadError ? null : storagePath,
        user_id: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert failed:', dbError);
      return null;
    }

    return data as AudioGeneration;
  } catch (err) {
    console.error('saveGeneration error:', err);
    return null;
  }
}

/**
 * Load recent generations from Supabase, newest first.
 * RLS automatically filters to current user's data.
 */
export async function loadHistory(limit = 20): Promise<AudioGeneration[]> {
  try {
    const { data, error } = await supabase
      .from('audio_generations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to load history:', error);
      return [];
    }

    return (data || []) as AudioGeneration[];
  } catch (err) {
    console.error('loadHistory error:', err);
    return [];
  }
}

/**
 * Delete a generation from both DB and Storage.
 */
export async function deleteGeneration(id: string, storagePath: string | null): Promise<boolean> {
  try {
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('audio')
        .remove([storagePath]);
      if (storageError) {
        console.error('Storage delete failed:', storageError);
      }
    }

    const { error: dbError } = await supabase
      .from('audio_generations')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('DB delete failed:', dbError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('deleteGeneration error:', err);
    return false;
  }
}

/**
 * Get public URL for an audio file in Storage.
 */
export function getAudioPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from('audio').getPublicUrl(storagePath);
  return data.publicUrl;
}
