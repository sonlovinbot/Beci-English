// Free Dictionary API + Pexels lazy fetchers
// Called ONLY when user adds a word to their list — never for browsing

export interface DictionaryResult {
  phonetic: string | null;
  audio: string | null;
  partOfSpeech: string | null;
  example: string | null;
}

export async function fetchDictionary(word: string): Promise<DictionaryResult | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    const phoneticObj = entry.phonetics?.find((p: { audio?: string }) => p.audio) || entry.phonetics?.[0];
    const audio = phoneticObj?.audio || null;
    const phonetic = entry.phonetic || phoneticObj?.text || null;
    const firstMeaning = entry.meanings?.[0];
    const partOfSpeech = firstMeaning?.partOfSpeech || null;
    const example = firstMeaning?.definitions?.find((d: { example?: string }) => d.example)?.example || null;

    // Normalize audio URL (some are protocol-relative //ssl.gstatic.com/...)
    const normalizedAudio = audio ? (audio.startsWith('//') ? `https:${audio}` : audio) : null;

    return {
      phonetic,
      audio: normalizedAudio,
      partOfSpeech,
      example,
    };
  } catch (err) {
    console.error('Dictionary fetch failed:', err);
    return null;
  }
}

// Pexels — requires VITE_PEXELS_API_KEY env var
// If not configured, returns null and UI falls back to placeholder.
export async function fetchPexelsImage(query: string): Promise<string | null> {
  const apiKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=medium`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    return photo?.src?.medium || photo?.src?.small || null;
  } catch (err) {
    console.error('Pexels fetch failed:', err);
    return null;
  }
}
