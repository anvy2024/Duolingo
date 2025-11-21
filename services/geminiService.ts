import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VocabularyWord, Language, NewsArticle } from "../types";

// Safe initialization of AI client to prevent white-screen crashes if env var is missing
let ai: GoogleGenAI;
try {
    // In Vite/Netlify, ensure the key is defined in Environment Variables
    // If process is undefined (browser), this might throw, so we catch it.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY is missing! Please add it to Netlify Environment Variables.");
    }
    ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY" });
} catch (e) {
    console.error("Error initializing GoogleGenAI client:", e);
    // Fallback to prevent app crash on load, calls will fail later with clear error
    ai = new GoogleGenAI({ apiKey: "MISSING_KEY" });
}

export type GenerationTopic = 'general' | 'common-verbs' | 'irregular-verbs';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export const generateVocabularyBatch = async (
    existingWords: string[] = [], 
    topic: GenerationTopic = 'general', 
    lang: Language,
    count: number = 10
): Promise<VocabularyWord[]> => {
  // IMPROVED: Send a larger, shuffled sample of existing words to the model to avoid repetition
  // We prioritize sending the most recently learned words + a random sample of older ones
  const recentWords = existingWords.slice(-50);
  const olderWords = existingWords.slice(0, -50).sort(() => 0.5 - Math.random()).slice(0, 150);
  const sampleExisting = [...recentWords, ...olderWords].join(", ");
  
  const modelId = "gemini-2.5-flash";
  
  let targetLang = 'French';
  let level = 'A1 (Beginner)';
  
  if (lang === 'en') {
      targetLang = 'English';
      level = 'B1 (Intermediate)';
  } else if (lang === 'zh') {
      targetLang = 'Chinese (Mandarin, Simplified)';
      level = 'A1 (Beginner)';
  } else if (lang === 'es') {
      targetLang = 'Spanish';
      level = 'A1 (Beginner)';
  }
  
  let specificInstruction = "";
  if (topic === 'common-verbs') {
    specificInstruction = `Generate ${count} useful ${targetLang} verbs (infinitive) for ${level} students.`;
  } else if (topic === 'irregular-verbs') {
    specificInstruction = `Generate ${count} common irregular ${targetLang} verbs for ${level} students.`;
  } else {
    specificInstruction = `Generate ${count} DISTINCT, useful ${targetLang} vocabulary words suitable for ${level} level (mix of nouns, verbs, adjectives).`;
  }

  // Logic for Vietnamese Pronunciation
  let pronunciationInstruction = '4. Provide "Vietnamese Pronunciation Guide" (Phiên âm bồi).';
  let sentencePronunciationInstruction = '7. Vietnamese pronunciation for the sentence.';
  let ipaInstruction = "3. Provide IPA.";

  if (lang === 'en') {
      pronunciationInstruction = '4. For "viet_pronunciation", return an EMPTY STRING.';
      sentencePronunciationInstruction = '7. For sentence pronunciation, return an EMPTY STRING.';
  } else if (lang === 'zh') {
      ipaInstruction = "3. Provide Pinyin with tone marks in the 'ipa' field (e.g., nǐ hǎo).";
      pronunciationInstruction = '4. Provide "Vietnamese Pronunciation Guide" (Bồi) in viet_pronunciation.';
  }
  
  const prompt = `
    You are an expert ${targetLang} teacher for Vietnamese students.
    ${specificInstruction}
    
    CRITICAL RULE: DO NOT include any words from this list: [${sampleExisting}].
    I need COMPLETELY NEW words.
    
    Requirements:
    1. Word must be in ${targetLang} (${level} difficulty).
    2. Provide meaning in Vietnamese.
    ${ipaInstruction}
    ${pronunciationInstruction}
    5. Simple example sentence suited for ${level}.
    6. Vietnamese translation of the sentence.
    ${sentencePronunciationInstruction}
    8. STRICTLY CHECK the exclude list. If a word is in [${sampleExisting}], DO NOT generate it.
    
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
    let targetLang = 'French';
    let level = 'A1';
    
    if (lang === 'en') { targetLang = 'English'; level = 'B1'; }
    else if (lang === 'zh') { targetLang = 'Chinese'; level = 'A1'; }
    else if (lang === 'es') { targetLang = 'Spanish'; level = 'A1'; }

    let pronunciationPrompt = 'Provide Vietnamese Pronunciation (Bồi).';
    if (lang === 'en') pronunciationPrompt = 'Return EMPTY STRING for viet_pronunciation.';
    if (lang === 'zh') pronunciationPrompt = 'Provide Pinyin in IPA field. Provide Viet Bồi in viet_pronunciation.';

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
    let targetLang = 'French';
    let level = 'A1';
    let searchRegion = 'CANADA';
    
    if (lang === 'en') { 
        targetLang = 'English'; 
        level = 'B1'; 
    } else if (lang === 'zh') { 
        targetLang = 'Chinese (Simplified)'; 
        level = 'A1'; 
        searchRegion = 'CHINA'; 
    } else if (lang === 'es') { 
        targetLang = 'Spanish'; 
        level = 'A1'; 
        searchRegion = 'SPAIN or MEXICO'; 
    }

    // Customize prompt based on language requirements
    let lengthInstruction = "The content should be a SIMPLE, short summary suitable for A1 beginners.";
    if (lang === 'en') {
        lengthInstruction = "The content MUST be a LONG, DETAILED article (approx. 300-500 words) suitable for B1 reading practice.";
    }

    const prompt = `
        Search for the latest news in ${searchRegion} (focus on major events).
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
    let targetLang = 'French';
    let pronunciationPrompt = 'Provide Vietnamese Pronunciation (Bồi).';
    
    if (lang === 'en') { 
        targetLang = 'English'; 
        pronunciationPrompt = 'Return EMPTY STRING for viet_pronunciation.'; 
    } else if (lang === 'zh') { 
        targetLang = 'Chinese'; 
        pronunciationPrompt = 'Provide Pinyin in IPA field. Provide Viet Bồi in viet_pronunciation.'; 
    } else if (lang === 'es') { 
        targetLang = 'Spanish'; 
    }
    
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

// Use 'gtx' client as it is more permissive, but note this is still unofficial
export const getSystemTTSUrl = (text: string, lang: Language): string => {
    let tl = 'fr';
    if (lang === 'en') tl = 'en';
    else if (lang === 'zh') tl = 'zh-CN';
    else if (lang === 'es') tl = 'es';
    
    // Use googleapis.com instead of google.com to reduce blocking probability
    return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=${encodeURIComponent(text)}`;
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

export const getHighQualityAudio = async (text: string, lang: Language = 'fr'): Promise<string> => {
    // Voice selection based on language
    // We use 'Kore' as it's a robust multilingual voice in the 2.5 series.
    let voiceName = 'Kore'; 

    // CRITICAL FIX: 'systemInstruction' causes 400 ERROR on TTS models. 
    // We must NOT use it.
    // To ensure correct language pronunciation (e.g. French "Chat" vs English "Chat"),
    // we embed the instruction into the prompt text itself.
    
    let promptText = text;

    // Force the model to acknowledge the language context
    if (lang === 'fr') {
        promptText = `Say in French: "${text}"`;
    } else if (lang === 'es') {
        promptText = `Say in Spanish: "${text}"`;
    } else if (lang === 'zh') {
        promptText = `Say in Chinese: "${text}"`;
    } else {
        // English usually defaults correctly, but explicit is safer
        promptText = `Say in English: "${text}"`;
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: {
                // We send the instructed prompt as the content
                parts: [{ text: promptText }]
            },
            config: {
                // STRICTLY NO systemInstruction HERE
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName } 
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

export const checkSentenceGrammar = async (word: string, sentence: string, lang: Language): Promise<{isCorrect: boolean, feedback: string, correction?: string}> => {
    let targetLang = 'French';
    if (lang === 'en') targetLang = 'English';
    else if (lang === 'zh') targetLang = 'Chinese';
    else if (lang === 'es') targetLang = 'Spanish';

    const prompt = `
        I am a student learning ${targetLang}.
        My task is to write a sentence using the word: "${word}".
        My sentence is: "${sentence}".
        
        Please check if my sentence is grammatically correct and natural.
        Respond in JSON format.
        
        Language for feedback (explanation): Vietnamese.
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
                        isCorrect: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING, description: "Explain in Vietnamese why it is correct or incorrect" },
                        correction: { type: Type.STRING, description: "If incorrect, provide the corrected version in target language. If correct, leave empty." }
                    },
                    required: ["isCorrect", "feedback"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        return JSON.parse(text);
    } catch (error) {
        console.error("Grammar check error:", error);
        return { isCorrect: false, feedback: "Lỗi kết nối AI. Vui lòng thử lại." };
    }
}