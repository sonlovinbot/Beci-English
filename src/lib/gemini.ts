import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractTextFromImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        
        const imagePart = {
          inlineData: {
            mimeType: file.type,
            data: base64String,
          },
        };
        
        const textPart = {
          text: "Extract all the text from this image. Only return the extracted text, nothing else. Preserve the original formatting as much as possible.",
        };
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts: [imagePart, textPart] },
        });
        
        resolve(response.text || "");
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide the IPA phonetic transcription for each word in the following text. Return ONLY a JSON array of strings, where each string is the IPA for the corresponding word. Do not include any markdown formatting. Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
      }
    });
    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Failed to get phonetics", error);
    return [];
  }
}

export async function generateAudio(text: string, voice: string, style: string): Promise<string> {
  const prompt = style ? `Say ${style}: ${text}` : text;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
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
    throw new Error("Failed to generate audio");
  }
  
  return base64Audio;
}
