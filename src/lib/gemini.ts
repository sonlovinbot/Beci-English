// All Gemini calls go through /api/gemini serverless function
// The API key stays on the server — never exposed to the browser

async function callApi(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function extractTextFromImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const data = await callApi('extractText', { base64, mimeType: file.type });
        resolve(data.text || '');
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function getPhonetics(text: string): Promise<string[]> {
  try {
    const data = await callApi('phonetics', { text });
    return data.phonetics || [];
  } catch (error) {
    console.error('Failed to get phonetics', error);
    return [];
  }
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export async function getWordTimings(text: string, audioDuration: number): Promise<WordTiming[]> {
  try {
    const data = await callApi('wordTimings', { text, audioDuration });
    return data.timings || [];
  } catch (error) {
    console.error('Failed to get word timings', error);
    return [];
  }
}

export async function suggestTitle(text: string): Promise<string> {
  try {
    const data = await callApi('suggestTitle', { text });
    return data.title || 'Untitled Lesson';
  } catch (error) {
    console.error('Failed to suggest title', error);
    return 'Untitled Lesson';
  }
}

// --- Listening Test Generation ---

export interface MultipleChoiceQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TrueFalseQuestion {
  statement: string;
  correct: boolean;
}

export interface FillBlankQuestion {
  textWithBlanks: string;
  blanks: string[];
}

export interface ListeningTest {
  multipleChoice: MultipleChoiceQuestion[];
  trueFalse: TrueFalseQuestion[];
  fillBlanks: FillBlankQuestion;
}

export async function generateListeningTest(
  transcript: string,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<ListeningTest> {
  const data = await callApi('generateTest', { transcript, difficulty });
  return data.test as ListeningTest;
}

export async function generateAudio(text: string, voice: string, style: string): Promise<string> {
  const data = await callApi('generateAudio', { text, voice, style });
  if (!data.audio) {
    throw new Error('Failed to generate audio');
  }
  return data.audio;
}
