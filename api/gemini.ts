import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, ...params } = req.body;

  try {
    switch (action) {
      case 'extractText': {
        const { base64, mimeType } = params;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: 'Extract all the text from this image. Return ONLY plain text, no markdown formatting (no #, *, **, `, ```, -, > or any other markdown symbols). Preserve line breaks and paragraph spacing but nothing else. Do not add any commentary.' },
            ],
          },
        });
        const raw = response.text || '';
        const plain = raw
          .replace(/```[\s\S]*?```/g, '')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/__([^_]+)__/g, '$1')
          .replace(/_([^_]+)_/g, '$1')
          .replace(/^>\s+/gm, '')
          .replace(/^[-*+]\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '')
          .trim();
        return res.json({ text: plain });
      }

      case 'phonetics': {
        const { text } = params;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Provide the IPA phonetic transcription for each word in the following text. Return ONLY a JSON array of strings, where each string is the IPA for the corresponding word. Do not include any markdown formatting. Text: "${text}"`,
          config: { responseMimeType: 'application/json' },
        });
        const result = JSON.parse(response.text || '[]');
        return res.json({ phonetics: Array.isArray(result) ? result : [] });
      }

      case 'wordTimings': {
        const { text, audioDuration } = params;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `You are an expert at estimating speech timing. Given the following English text that is read aloud in ${audioDuration.toFixed(1)} seconds total, estimate the start and end time (in seconds) for each word.

Consider that:
- Common short words (the, a, is, it, in, of, to, and, for) are spoken quickly (~0.15-0.25s)
- Medium words (2-3 syllables) take ~0.3-0.5s
- Long words (4+ syllables) take ~0.5-0.8s
- Punctuation (periods, commas) adds natural pauses (~0.2-0.5s after the word)
- Paragraph breaks add longer pauses (~0.5-1.0s)
- Speaking style affects pacing - allocate time proportionally
- The total time MUST fit within ${audioDuration.toFixed(1)} seconds

Text: "${text}"

Return ONLY a JSON array of objects with "word", "start", "end" fields. No markdown.`,
          config: { responseMimeType: 'application/json' },
        });
        const result = JSON.parse(response.text || '[]');
        return res.json({ timings: Array.isArray(result) ? result : [] });
      }

      case 'suggestTitle': {
        const { text } = params;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Suggest a short, descriptive title (max 6 words) for this English lesson/audio based on the text content. Return ONLY the title text, nothing else. Text: "${text.slice(0, 500)}"`,
        });
        return res.json({ title: (response.text || 'Untitled Lesson').trim() });
      }

      case 'generateTest': {
        const { transcript, difficulty } = params;
        const difficultyGuide: Record<string, string> = {
          easy: 'A2 level. Use simple vocabulary and straightforward questions. 5 multiple choice, 5 true/false. Fill-in blanks should remove common A2 words.',
          medium: 'B1 level. Use moderate vocabulary with some inference required. 7 multiple choice, 6 true/false. Fill-in blanks should remove B1 vocabulary and key phrases.',
          hard: 'B2 level. Require deeper comprehension, inference, and attention to detail. 10 multiple choice, 8 true/false. Fill-in blanks should remove advanced vocabulary and idiomatic expressions.',
        };
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `You are an English listening test creator. Based on this transcript, create a comprehensive listening test.

Difficulty: ${difficultyGuide[difficulty]}

Transcript:
"${transcript}"

Create a JSON object with exactly this structure:
{
  "multipleChoice": [
    { "question": "What is...?", "options": ["A", "B", "C", "D"], "correctIndex": 0 }
  ],
  "trueFalse": [
    { "statement": "The speaker said...", "correct": true }
  ],
  "fillBlanks": {
    "textWithBlanks": "The transcript with ___BLANK_1___ replacing about 40% of key words...",
    "blanks": ["word1", "word2", "..."]
  }
}

Rules:
- Multiple choice: each question has exactly 4 options. correctIndex is 0-3.
- True/False: mix of true and false statements. About 50/50 split.
- Fill blanks: Take the ORIGINAL transcript and replace approximately 40% of content words with numbered blanks (___BLANK_1___, ___BLANK_2___, etc). Focus on ${difficulty === 'easy' ? 'A2' : difficulty === 'medium' ? 'B1' : 'B2'} vocabulary. Keep function words (the, a, is, are, etc) visible. The blanks array must contain the correct answers in order.
- Questions should progress from easier to harder.
- All questions must be answerable from the transcript alone.

Return ONLY valid JSON, no markdown.`,
          config: { responseMimeType: 'application/json' },
        });
        const result = JSON.parse(response.text || '{}');
        return res.json({ test: result });
      }

      case 'generateAudio': {
        const { text, voice, style } = params;
        const prompt = style ? `Say ${style}: ${text}` : text;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          return res.status(500).json({ error: 'Failed to generate audio' });
        }
        return res.json({ audio: base64Audio });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error('Gemini API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
