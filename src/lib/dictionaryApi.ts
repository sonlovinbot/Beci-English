// Free Dictionary API + Pexels lazy fetchers
// Called ONLY when user adds a word to their list — never for browsing

export interface DictionaryResult {
  phonetic: string | null;
  audio: string | null;
  partOfSpeech: string | null;
  meaningEn: string | null;
  example: string | null;
  synonyms: string[];
  antonyms: string[];
}

interface DictDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
  synonyms?: string[];
  antonyms?: string[];
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

    const firstMeaning: DictMeaning | undefined = entry.meanings?.[0];
    const firstDef: DictDefinition | undefined = firstMeaning?.definitions?.[0];
    const partOfSpeech = firstMeaning?.partOfSpeech || null;
    const meaningEn = firstDef?.definition || null;
    const example = firstMeaning?.definitions?.find((d: DictDefinition) => d.example)?.example || null;

    // Aggregate synonyms and antonyms across all meanings + definitions, dedupe
    const synSet = new Set<string>();
    const antSet = new Set<string>();
    (entry.meanings || []).forEach((m: DictMeaning) => {
      (m.synonyms || []).forEach((s: string) => synSet.add(s));
      (m.antonyms || []).forEach((s: string) => antSet.add(s));
      (m.definitions || []).forEach((d: DictDefinition) => {
        (d.synonyms || []).forEach((s: string) => synSet.add(s));
        (d.antonyms || []).forEach((s: string) => antSet.add(s));
      });
    });

    const normalizedAudio = audio ? (audio.startsWith('//') ? `https:${audio}` : audio) : null;

    return {
      phonetic,
      audio: normalizedAudio,
      partOfSpeech,
      meaningEn,
      example,
      synonyms: [...synSet].slice(0, 8),
      antonyms: [...antSet].slice(0, 6),
    };
  } catch (err) {
    console.error('Dictionary fetch failed:', err);
    return null;
  }
}

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
