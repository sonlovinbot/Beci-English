import { supabase } from './supabase';

export interface VocabularyWord {
  id: string;
  user_id: string;
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  meaning_vi: string | null;
  example_en: string | null;
  example_vi: string | null;
  audio_url: string | null;
  image_url: string | null;
  source: string;
  srs_level: number;
  next_review_at: string;
  review_count: number;
  correct_count: number;
  created_at: string;
  updated_at: string;
}

export interface AddWordInput {
  word: string;
  phonetic?: string;
  part_of_speech?: string;
  meaning_vi?: string;
  example_en?: string;
  example_vi?: string;
  audio_url?: string;
  image_url?: string;
  source: string;
}

// SRS intervals in days: level -> next gap
const SRS_INTERVALS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export function calculateNextReview(currentLevel: number, remembered: boolean): { level: number; nextAt: Date } {
  const now = new Date();
  let newLevel: number;
  let days: number;

  if (remembered) {
    newLevel = Math.min(5, currentLevel + 1);
    days = SRS_INTERVALS[newLevel];
  } else {
    // Reset to 1 (except level 1 stays at 1)
    newLevel = 1;
    days = 1;
  }

  const nextAt = new Date(now);
  nextAt.setDate(now.getDate() + days);
  return { level: newLevel, nextAt };
}

export async function addWord(input: AddWordInput): Promise<VocabularyWord | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_vocabulary')
      .insert({
        user_id: user.id,
        word: input.word.toLowerCase().trim(),
        phonetic: input.phonetic ?? null,
        part_of_speech: input.part_of_speech ?? null,
        meaning_vi: input.meaning_vi ?? null,
        example_en: input.example_en ?? null,
        example_vi: input.example_vi ?? null,
        audio_url: input.audio_url ?? null,
        image_url: input.image_url ?? null,
        source: input.source,
      })
      .select()
      .single();

    if (error) {
      // Duplicate (unique constraint) — not fatal
      if (error.code === '23505') return null;
      console.error('addWord error:', error);
      return null;
    }
    return data as VocabularyWord;
  } catch (err) {
    console.error('addWord exception:', err);
    return null;
  }
}

export async function addWordsBulk(inputs: AddWordInput[]): Promise<number> {
  let added = 0;
  for (const input of inputs) {
    const result = await addWord(input);
    if (result) added++;
  }
  return added;
}

export async function loadMyVocabulary(): Promise<VocabularyWord[]> {
  try {
    const { data, error } = await supabase
      .from('user_vocabulary')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadMyVocabulary error:', error);
      return [];
    }
    return (data || []) as VocabularyWord[];
  } catch (err) {
    console.error('loadMyVocabulary exception:', err);
    return [];
  }
}

export async function loadDueVocabulary(limit = 20): Promise<VocabularyWord[]> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_vocabulary')
      .select('*')
      .lte('next_review_at', nowIso)
      .order('next_review_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('loadDueVocabulary error:', error);
      return [];
    }
    return (data || []) as VocabularyWord[];
  } catch (err) {
    console.error('loadDueVocabulary exception:', err);
    return [];
  }
}

export async function updateWordSrs(id: string, remembered: boolean): Promise<boolean> {
  try {
    // Fetch current level
    const { data: current, error: fetchErr } = await supabase
      .from('user_vocabulary')
      .select('srs_level, review_count, correct_count')
      .eq('id', id)
      .single();
    if (fetchErr || !current) return false;

    const { level, nextAt } = calculateNextReview(current.srs_level, remembered);

    const { error } = await supabase
      .from('user_vocabulary')
      .update({
        srs_level: level,
        next_review_at: nextAt.toISOString(),
        review_count: current.review_count + 1,
        correct_count: current.correct_count + (remembered ? 1 : 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('updateWordSrs error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateWordSrs exception:', err);
    return false;
  }
}

export async function deleteWord(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_vocabulary').delete().eq('id', id);
    if (error) {
      console.error('deleteWord error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('deleteWord exception:', err);
    return false;
  }
}

export async function enrichWord(id: string, updates: Partial<Omit<VocabularyWord, 'id' | 'user_id' | 'created_at'>>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_vocabulary')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('enrichWord error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('enrichWord exception:', err);
    return false;
  }
}

export async function getWordsInMyList(words: string[]): Promise<Set<string>> {
  try {
    if (words.length === 0) return new Set();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    const lowered = words.map(w => w.toLowerCase().trim());
    const { data, error } = await supabase
      .from('user_vocabulary')
      .select('word')
      .in('word', lowered);

    if (error) return new Set();
    return new Set((data || []).map((r: { word: string }) => r.word));
  } catch {
    return new Set();
  }
}
