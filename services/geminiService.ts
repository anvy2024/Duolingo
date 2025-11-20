import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VocabularyWord, Language, NewsArticle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export type GenerationTopic = 'general' | 'common-verbs' | 'irregular-verbs';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const generateVocabularyBatch = async (existingWords: string[] = [], topic: GenerationTopic = 'general', lang: Language): Promise<VocabularyWord[]> => {
  // Limit existing words sent to model to save tokens, but pick a random sample to avoid repetition patterns
  const sampleExisting = existingWords.sort(() => 0.5 - Math.random()).slice(100).join(", ");
  
  const modelId = "gemini-2.5-flash";
  
  const targetLang = lang === 'fr' ? 'French' : 'English';
  const level = lang === 'fr' ? 'A1 (Beginner)' : 'B1 (Intermediate)';
  
  let specificInstruction = "";
  if (topic === 'common-verbs') {
    specificInstruction = `Generate 10 useful ${targetLang} verbs (infinitive) for ${level} students.`;
  } else if (topic === 'irregular-verbs') {
    specificInstruction = `Generate 10 common irregular ${targetLang} verbs for ${level} students.`;
  } else {
    specificInstruction = `Generate 10 distinct, useful ${targetLang} vocabulary words suitable for ${level} level (mix of nouns, verbs, adjectives).`;
  }

  // Logic for Vietnamese Pronunciation
  const pronunciationInstruction = lang === 'fr' 
    ? '4. Provide "Vietnamese Pronunciation Guide" (Phiên âm bồi).' 
    : '4. For "viet_pronunciation", return an EMPTY STRING (Do not provide phonetic spelling for English B1).';
  
  const sentencePronunciationInstruction = lang === 'fr'
    ? '7. Vietnamese pronunciation for the sentence.'
    : '7. For sentence pronunciation, return an EMPTY STRING.';

  const prompt = `
    You are an expert ${targetLang} teacher for Vietnamese students.
    ${specificInstruction}
    
    Requirements:
    1. Word must be in ${targetLang} (${level} difficulty).
    2. Provide meaning in Vietnamese.
    3. Provide IPA.
    ${pronunciationInstruction}
    5. Simple example sentence suited for ${level}.
    6. Vietnamese translation of the sentence.
    ${sentencePronunciationInstruction}
    8. Ensure the words are NOT in this list: [${sampleExisting}]
    
    Return ONLY valid JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              target: { type: Type.STRING },
              vietnamese: { type: Type.STRING },
              ipa: { type: Type.STRING },
              viet_pronunciation: { type: Type.STRING },
              example: {
                type: Type.OBJECT,
                properties: {
                    target: { type: Type.STRING },
                    vietnamese: { type: Type.STRING },
                    viet_pronunciation: { type: Type.STRING }
                },
                required: ["target", "vietnamese", "viet_pronunciation"]
              }
            },
            required: ["target", "vietnamese", "ipa", "viet_pronunciation", "example"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const rawData = JSON.parse(text);
    
    return rawData.map((item: any) => ({
        id: generateId(),
        target: item.target,
        vietnamese: item.vietnamese,
        ipa: item.ipa,
        viet_pronunciation: item.viet_pronunciation,
        example: {
            target: item.example.target,
            vietnamese: item.example.vietnamese,
            viet_pronunciation: item.example.viet_pronunciation
        },
        learnedAt: Date.now(),
        category: topic
    }));

  } catch (error) {
    console.error("Error generating vocabulary:", error);
    throw error;
  }
};

export const generateSingleWordDetails = async (word: string, lang: Language): Promise<Omit<VocabularyWord, 'id' | 'learnedAt' | 'mastered' | 'isFavorite'>> => {
    const targetLang = lang === 'fr' ? 'French' : 'English';
    const level = lang === 'fr' ? 'A1' : 'B1';

    const pronunciationPrompt = lang === 'fr' 
        ? 'Provide Vietnamese Pronunciation (Bồi).' 
        : 'Return EMPTY STRING for viet_pronunciation.';

    const prompt = `
      I have a ${targetLang} word: "${word}".
      Please provide details for a Level ${level} student.
      ${pronunciationPrompt}
      Return valid JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        target: { type: Type.STRING },
                        vietnamese: { type: Type.STRING },
                        ipa: { type: Type.STRING },
                        viet_pronunciation: { type: Type.STRING },
                        category: { type: Type.STRING, enum: ['general', 'common-verbs', 'irregular-verbs'] },
                        example: {
                            type: Type.OBJECT,
                            properties: {
                                target: { type: Type.STRING },
                                vietnamese: { type: Type.STRING },
                                viet_pronunciation: { type: Type.STRING }
                            },
                            required: ["target", "vietnamese", "viet_pronunciation"]
                        }
                    },
                    required: ["target", "vietnamese", "ipa", "viet_pronunciation", "example"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from Gemini");
        return JSON.parse(text);

    } catch (error) {
        console.error("Error generating word details:", error);
        throw error;
    }
};

export const generateCanadianNews = async (lang: Language): Promise<NewsArticle[]> => {
    const targetLang = lang === 'fr' ? 'French' : 'English';
    const level = lang === 'fr' ? 'A1' : 'B1';

    // Customize prompt based on language requirements
    let lengthInstruction = "";
    if (lang === 'en') {
        lengthInstruction = "The content MUST be a LONG, DETAILED article (approx. 300-500 words) suitable for B1 reading practice. Do not summarize it too much, keep the details.";
    } else {
        lengthInstruction = "The content should be a SIMPLE, short summary suitable for A1 beginners.";
    }

    const prompt = `
        Search for the latest news in CANADA (focus on major events).
        Select 3 interesting stories.
        
        For each story, rewrite it into ${targetLang} for ${level} level learners.
        ${lengthInstruction}
        Provide a Vietnamese translation for the entire text.
        
        OUTPUT FORMAT (Strictly follow this):
        
        ###STORY###
        TITLE: [Original Title]
        SUMMARY: [The ${targetLang} content]
        TRANSLATION: [Vietnamese translation]
        DATE: [Date string]
        ###END###
        
        Do this for 3 stories.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const text = response.text || "";
        
        const articles: NewsArticle[] = [];
        const chunks = text.split('###STORY###');
        
        for (const chunk of chunks) {
            if (!chunk.trim() || !chunk.includes('###END###')) continue;
            
            const titleMatch = chunk.match(/TITLE:\s*(.+)/);
            const summaryMatch = chunk.match(/SUMMARY:\s*([\s\S]+?)TRANSLATION:/);
            const translationMatch = chunk.match(/TRANSLATION:\s*([\s\S]+?)DATE:/);
            const dateMatch = chunk.match(/DATE:\s*(.+)/);
            
            if (titleMatch && summaryMatch && translationMatch) {
                articles.push({
                    id: generateId(),
                    title: titleMatch[1].trim(),
                    summary: summaryMatch[1].trim(),
                    translation: translationMatch[1].trim(),
                    date: dateMatch ? dateMatch[1].replace('###END###', '').trim() : new Date().toLocaleDateString()
                });
            }
        }
        
        if (articles.length === 0) {
             throw new Error("Could not parse news format");
        }
        
        return articles;

    } catch (error) {
        console.error("Error fetching news:", error);
        throw error;
    }
};

export const generateLookupDetail = async (text: string, lang: Language): Promise<VocabularyWord> => {
    const targetLang = lang === 'fr' ? 'French' : 'English';
    const pronunciationPrompt = lang === 'fr' 
        ? 'Provide Vietnamese Pronunciation (Bồi).' 
        : 'Return EMPTY STRING for viet_pronunciation.';
    
    const prompt = `
        I am a ${targetLang} learner.
        Explain this text: "${text}".
        
        If it is a single word or short phrase: Provide definition, IPA, and a NEW example sentence.
        If it is a long sentence/paragraph: Treat the "target" as the sentence itself, provide translation, IPA/Pronunciation for the sentence. For the "example" field, just copy the sentence itself again to fill the schema.
        
        Target Language: ${targetLang}
        Native Language: Vietnamese
        ${pronunciationPrompt}
        
        Return valid JSON matching the schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        target: { type: Type.STRING, description: "The word or phrase being explained" },
                        vietnamese: { type: Type.STRING, description: "Vietnamese meaning or translation" },
                        ipa: { type: Type.STRING },
                        viet_pronunciation: { type: Type.STRING },
                        example: {
                            type: Type.OBJECT,
                            properties: {
                                target: { type: Type.STRING },
                                vietnamese: { type: Type.STRING },
                                viet_pronunciation: { type: Type.STRING }
                            },
                            required: ["target", "vietnamese", "viet_pronunciation"]
                        },
                        category: { type: Type.STRING, enum: ["general"] }
                    },
                    required: ["target", "vietnamese", "ipa", "viet_pronunciation", "example"]
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response");
        
        const data = JSON.parse(jsonText);
        
        return {
            id: generateId(),
            target: data.target,
            vietnamese: data.vietnamese,
            ipa: data.ipa,
            viet_pronunciation: data.viet_pronunciation,
            example: {
                target: data.example.target,
                vietnamese: data.example.vietnamese,
                viet_pronunciation: data.example.viet_pronunciation
            },
            category: 'general',
            learnedAt: Date.now(),
            mastered: false,
            isFavorite: false
        };

    } catch (error) {
        console.error("Lookup error:", error);
        throw error;
    }
}

export const getSystemTTSUrl = (text: string, lang: Language): string => {
    const tl = lang === 'fr' ? 'fr' : 'en';
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(text)}`;
}

const addWavHeader = (pcmData: Uint8Array, sampleRate: number = 24000): ArrayBuffer => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const pcmView = new Uint8Array(buffer, 44);
    pcmView.set(pcmData);

    return buffer;
};

export const getHighQualityAudio = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: {
                parts: [{ text: text }]
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Fenrir' } 
                    }
                }
            }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data returned");
        
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const wavBuffer = addWavHeader(bytes, 24000);
        
        let binary = '';
        const bytesWav = new Uint8Array(wavBuffer);
        const lenWav = bytesWav.byteLength;
        for (let i = 0; i < lenWav; i++) {
            binary += String.fromCharCode(bytesWav[i]);
        }
        
        return btoa(binary);
    } catch (error) {
        console.error("Error generating AI speech:", error);
        throw error;
    }
}