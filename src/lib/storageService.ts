import { supabase } from './supabase';
import { pcmBase64ToWavBlob } from './audioUtils';

// Convert WAV blob → base64 (browser-safe, no Buffer)
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface BunnyUploadResult {
  url: string | null;
  error: string | null;
}

async function uploadToBunny(path: string, base64: string, contentType: string): Promise<BunnyUploadResult> {
  try {
    const res = await fetch('/api/bunny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload', path, base64, contentType }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Bunny upload failed:', res.status, text);
      // Try to parse JSON error
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j.error) msg = j.error;
      } catch {
        if (text) msg = text.slice(0, 200);
      }
      // Hint for common cases
      if (res.status === 404) {
        msg = '/api/bunny route not found. Run `vercel dev` locally, or deploy to Vercel.';
      } else if (res.status === 413) {
        msg = `File too large for Vercel (>4.5MB). Try shorter audio. (${msg})`;
      } else if (res.status === 500 && msg.includes('not configured')) {
        msg = 'Bunny env vars missing. Set BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_CDN_HOST in Vercel.';
      }
      return { url: null, error: msg };
    }
    const data = await res.json();
    return { url: data.url || null, error: null };
  } catch (err) {
    console.error('Bunny upload exception:', err);
    const message = err instanceof Error ? err.message : 'Network error';
    return { url: null, error: message };
  }
}

async function deleteFromBunny(path: string): Promise<boolean> {
  try {
    const res = await fetch('/api/bunny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', path }),
    });
    return res.ok;
  } catch (err) {
    console.error('Bunny delete exception:', err);
    return false;
  }
}

// Extract Bunny path from full CDN URL (for delete operations)
function bunnyPathFromUrl(url: string): string | null {
  // e.g. https://beci-english.b-cdn.net/userId/audio_xxx.wav -> userId/audio_xxx.wav
  const match = url.match(/^https:\/\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

export interface AudioGeneration {
  id: string;
  title: string;
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
  title: string,
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

    // 1. Convert base64 PCM to WAV blob, then to base64 for transport
    const wavBlob = pcmBase64ToWavBlob(base64Audio);
    const wavBase64 = await blobToBase64(wavBlob);
    const fileName = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`;
    const path = `${user.id}/${fileName}`;

    // 2. Upload WAV to Bunny CDN (server-side, key stays hidden)
    const upload = await uploadToBunny(path, wavBase64, 'audio/wav');
    if (!upload.url) {
      // Don't create an orphan DB row without audio. Throw so UI sees the error.
      throw new Error(upload.error || 'Bunny upload failed');
    }
    const cdnUrl = upload.url;

    // 3. Insert row into database — store full CDN URL
    const row = {
      title,
      text,
      voice,
      style,
      audio_storage_path: cdnUrl,
      user_id: user.id,
    };

    let { data, error: dbError } = await supabase
      .from('audio_generations')
      .insert(row)
      .select()
      .single();

    // If title column doesn't exist yet, retry without it
    if (dbError && dbError.message?.includes('title')) {
      console.warn('title column not found, retrying without it');
      const { title: _unused, ...rowWithoutTitle } = row;
      const retry = await supabase
        .from('audio_generations')
        .insert(rowWithoutTitle)
        .select()
        .single();
      data = retry.data;
      dbError = retry.error;
    }

    if (dbError) {
      console.error('DB insert failed:', dbError);
      return null;
    }

    return data as AudioGeneration;
  } catch (err) {
    console.error('saveGeneration error:', err);
    // Re-throw so the caller can show a specific error to the user
    throw err;
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
      if (/^https?:\/\//i.test(storagePath)) {
        // Bunny CDN URL — delete via /api/bunny
        const path = bunnyPathFromUrl(storagePath);
        if (path) await deleteFromBunny(path);
      } else {
        // Legacy Supabase Storage path
        const { error: storageError } = await supabase.storage
          .from('audio')
          .remove([storagePath]);
        if (storageError) {
          console.error('Storage delete failed:', storageError);
        }
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
 * Update the title of an existing generation.
 */
export async function updateGenerationTitle(id: string, title: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('audio_generations')
      .update({ title })
      .eq('id', id);

    if (error) {
      console.error('Failed to update title:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateGenerationTitle error:', err);
    return false;
  }
}

/**
 * Get public URL for an audio file.
 * - If storagePath is already a full URL (Bunny CDN), return as-is.
 * - Otherwise treat as legacy Supabase Storage path.
 */
export function getAudioPublicUrl(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const { data } = supabase.storage.from('audio').getPublicUrl(storagePath);
  return data.publicUrl;
}

// --- Listening Tests ---

export interface SavedTest {
  id: string;
  audio_generation_id: string;
  user_id: string;
  difficulty: string;
  test_data: unknown;
  score_mc: number | null;
  score_tf: number | null;
  score_fill: number | null;
  score_total: number | null;
  score_max: number | null;
  completed: boolean;
  created_at: string;
}

export async function saveTest(
  audioGenerationId: string,
  difficulty: string,
  testData: unknown
): Promise<SavedTest | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('listening_tests')
      .insert({
        audio_generation_id: audioGenerationId,
        user_id: user.id,
        difficulty,
        test_data: testData,
        completed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save test:', error);
      return null;
    }
    return data as SavedTest;
  } catch (err) {
    console.error('saveTest error:', err);
    return null;
  }
}

export async function updateTestScore(
  testId: string,
  scoreMc: number,
  scoreTf: number,
  scoreFill: number,
  scoreTotal: number,
  scoreMax: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('listening_tests')
      .update({
        score_mc: scoreMc,
        score_tf: scoreTf,
        score_fill: scoreFill,
        score_total: scoreTotal,
        score_max: scoreMax,
        completed: true,
      })
      .eq('id', testId);

    if (error) {
      console.error('Failed to update test score:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateTestScore error:', err);
    return false;
  }
}

export async function loadTestsForAudio(audioGenerationId: string): Promise<SavedTest[]> {
  try {
    const { data, error } = await supabase
      .from('listening_tests')
      .select('*')
      .eq('audio_generation_id', audioGenerationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to load tests:', error);
      return [];
    }
    return (data || []) as SavedTest[];
  } catch (err) {
    console.error('loadTestsForAudio error:', err);
    return [];
  }
}
