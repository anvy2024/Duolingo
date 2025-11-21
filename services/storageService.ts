import { VocabularyWord, Language, NewsArticle } from "../types";
import { FontSize } from "../App";

const getStorageKey = (lang: Language) => `vocab_data_${lang}_v1`;
const getNewsStorageKey = (lang: Language) => `news_data_${lang}_v1`;
const SETTINGS_KEY = 'app_settings_v1';
const AUDIO_CACHE_KEY = 'audio_cache_v1';

// --- TYPES FOR BACKUP ---
export interface AppSettings {
    fontSize: FontSize;
    playbackSpeed: number;
    swipeAutoplay: boolean;
}

export interface FullBackup {
    version: number;
    lang: Language;
    vocab: VocabularyWord[];
    news: NewsArticle[];
    audioCache: Record<string, string>; // Text -> Base64 DataURI
    settings: AppSettings;
    timestamp: number;
}

// --- INITIAL DATA ---
// Initial data for French (A1)
const INITIAL_DATA_FR: VocabularyWord[] = [
  {
    "id": "init_fr_1",
    "target": "Bonjour",
    "vietnamese": "Xin chào",
    "ipa": "/bɔ̃.ʒuʁ/",
    "viet_pronunciation": "Bông-giua",
    "example": {
      "target": "Bonjour, comment ça va ?",
      "vietnamese": "Xin chào, bạn khỏe không?",
      "viet_pronunciation": "Bông-giua, co-măng sa va?"
    },
    "category": "general",
    "mastered": false,
    "isFavorite": false,
    "learnedAt": 1700000000000
  },
  {
    "id": "init_fr_2",
    "target": "Merci",
    "vietnamese": "Cảm ơn",
    "ipa": "/mɛʁ.si/",
    "viet_pronunciation": "Méc-xi",
    "example": {
      "target": "Merci beaucoup pour votre aide.",
      "vietnamese": "Cảm ơn rất nhiều vì sự giúp đỡ của bạn.",
      "viet_pronunciation": "Méc-xi bô-cu pur vốt-trờ ét-đờ."
    },
    "category": "general",
    "mastered": false,
    "isFavorite": false,
    "learnedAt": 1700000000001
  }
];

// Initial data for English (B1 - Intermediate)
const INITIAL_DATA_EN: VocabularyWord[] = [
    {
      "id": "init_en_b1_1",
      "target": "Accomplish",
      "vietnamese": "Hoàn thành, đạt được",
      "ipa": "/əˈkʌm.plɪʃ/",
      "viet_pronunciation": "",
      "example": {
        "target": "I feel like I accomplished a lot today.",
        "vietnamese": "Tôi cảm thấy mình đã hoàn thành được rất nhiều việc hôm nay.",
        "viet_pronunciation": ""
      },
      "category": "general",
      "mastered": false,
      "isFavorite": false,
      "learnedAt": 1700000000000
    },
    {
      "id": "init_en_b1_2",
      "target": "Argument",
      "vietnamese": "Cuộc tranh luận, lý lẽ",
      "ipa": "/ˈɑːrɡ.jə.mənt/",
      "viet_pronunciation": "",
      "example": {
        "target": "We had a heated argument about politics.",
        "vietnamese": "Chúng tôi đã có một cuộc tranh luận sôi nổi về chính trị.",
        "viet_pronunciation": ""
      },
      "category": "general",
      "mastered": false,
      "isFavorite": false,
      "learnedAt": 1700000000001
    }
];

// Initial data for Chinese (A1)
const INITIAL_DATA_ZH: VocabularyWord[] = [
    {
      "id": "init_zh_1",
      "target": "你好",
      "vietnamese": "Xin chào",
      "ipa": "Nǐ hǎo",
      "viet_pronunciation": "Ni hảo",
      "example": {
        "target": "你好，你叫什么名字？",
        "vietnamese": "Xin chào, bạn tên là gì?",
        "viet_pronunciation": "Ni hảo, ni cheo sấn mơ mính chự?"
      },
      "category": "general",
      "mastered": false,
      "isFavorite": false,
      "learnedAt": 1700000000000
    },
    {
      "id": "init_zh_2",
      "target": "谢谢",
      "vietnamese": "Cảm ơn",
      "ipa": "Xièxiè",
      "viet_pronunciation": "Xia xia",
      "example": {
        "target": "谢谢你的帮助。",
        "vietnamese": "Cảm ơn sự giúp đỡ của bạn.",
        "viet_pronunciation": "Xia xia ni tơ bang chu."
      },
      "category": "general",
      "mastered": false,
      "isFavorite": false,
      "learnedAt": 1700000000001
    }
];

// Initial data for Spanish (A1)
const INITIAL_DATA_ES: VocabularyWord[] = [
    {
      "id": "init_es_1",
      "target": "Hola",
      "vietnamese": "Xin chào",
      "ipa": "/ˈo.la/",
      "viet_pronunciation": "Ô-la",
      "example": {
        "target": "Hola, ¿cómo estás?",
        "vietnamese": "Xin chào, bạn khỏe không?",
        "viet_pronunciation": "Ô-la, cô-mô ét-x-tát?"
      },
      "category": "general",
      "mastered": false,
      "isFavorite": false,
      "learnedAt": 1700000000000
    },
    {
      "id": "init_es_2",
      "target": "Gracias",
      "vietnamese": "Cảm ơn",
      "ipa": "/ˈɡɾa.θjas/",
      "viet_pronunciation": "G-ra-xi-át",
      "example": {
        "target": "Muchas gracias por todo.",
        "vietnamese": "Cảm ơn rất nhiều vì tất cả.",
        "viet_pronunciation": "Mu-chát g-ra-xi-át po tô-đô."
      },
      "category": "general",
      "mastered": false,
      "isFavorite": false,
      "learnedAt": 1700000000001
    }
];

// --- VOCABULARY FUNCTIONS ---

export const saveVocabularyData = (words: VocabularyWord[], lang: Language): void => {
    try {
        const jsonString = JSON.stringify(words);
        localStorage.setItem(getStorageKey(lang), jsonString);
    } catch (error) {
        console.error("Failed to save data", error);
    }
};

export const loadVocabularyData = (lang: Language): VocabularyWord[] => {
    try {
        const jsonString = localStorage.getItem(getStorageKey(lang));
        if (!jsonString) {
            if (lang === 'fr') {
                 // Backward compatibility check for French
                const oldData = localStorage.getItem('french_vocab_a1_data_json');
                if (oldData) {
                    const parsedOld = JSON.parse(oldData);
                    const migrated = parsedOld.map((w: any) => ({
                        ...w,
                        target: w.french || w.target,
                        example: {
                            ...w.example,
                            target: w.example.french || w.example.target
                        }
                    }));
                    saveVocabularyData(migrated, 'fr');
                    return migrated;
                }
                saveVocabularyData(INITIAL_DATA_FR, 'fr');
                return INITIAL_DATA_FR;
            } else if (lang === 'en') {
                saveVocabularyData(INITIAL_DATA_EN, 'en');
                return INITIAL_DATA_EN;
            } else if (lang === 'zh') {
                saveVocabularyData(INITIAL_DATA_ZH, 'zh');
                return INITIAL_DATA_ZH;
            } else if (lang === 'es') {
                saveVocabularyData(INITIAL_DATA_ES, 'es');
                return INITIAL_DATA_ES;
            }
            return [];
        }
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to load data", error);
        return [];
    }
};

export const appendVocabulary = (newWords: VocabularyWord[], lang: Language): VocabularyWord[] => {
    const currentData = loadVocabularyData(lang);
    const distinctNewWords = newWords.filter(
        nw => !currentData.some(existing => existing.target.toLowerCase() === nw.target.toLowerCase())
    );
    const updatedData = [...currentData, ...distinctNewWords];
    saveVocabularyData(updatedData, lang);
    return updatedData;
};

export const updateWordStatus = (wordId: string, updates: Partial<VocabularyWord>, lang: Language): VocabularyWord[] => {
    const currentData = loadVocabularyData(lang);
    const index = currentData.findIndex(w => w.id === wordId);
    if (index !== -1) {
        currentData[index] = { ...currentData[index], ...updates };
        saveVocabularyData(currentData, lang);
    }
    return currentData;
};

export const editVocabularyWord = (wordId: string, updatedWord: VocabularyWord, lang: Language): VocabularyWord[] => {
    const currentData = loadVocabularyData(lang);
    const index = currentData.findIndex(w => w.id === wordId);
    if (index !== -1) {
        currentData[index] = { ...currentData[index], ...updatedWord, id: wordId }; 
        saveVocabularyData(currentData, lang);
    }
    return currentData;
};

export const removeVocabularyWord = (wordId: string, lang: Language): VocabularyWord[] => {
    const currentData = loadVocabularyData(lang);
    const updatedData = currentData.filter(w => w.id !== wordId);
    saveVocabularyData(updatedData, lang);
    return updatedData;
}

// --- NEWS PERSISTENCE ---

export const loadNewsData = (lang: Language): NewsArticle[] => {
    try {
        const jsonString = localStorage.getItem(getNewsStorageKey(lang));
        if (!jsonString) return [];
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to load news", error);
        return [];
    }
};

export const saveNewsData = (articles: NewsArticle[], lang: Language): void => {
    try {
        localStorage.setItem(getNewsStorageKey(lang), JSON.stringify(articles));
    } catch (error) {
        console.error("Failed to save news", error);
    }
};

export const appendNewsData = (newArticles: NewsArticle[], lang: Language): NewsArticle[] => {
    const current = loadNewsData(lang);
    // Filter duplicates by title
    const uniqueNew = newArticles.filter(na => !current.some(ex => ex.title === na.title));
    const updated = [...uniqueNew, ...current]; // Put new ones at the top
    saveNewsData(updated, lang);
    return updated;
};

export const deleteNewsArticle = (id: string, lang: Language): NewsArticle[] => {
    const current = loadNewsData(lang);
    const updated = current.filter(a => a.id !== id);
    saveNewsData(updated, lang);
    return updated;
};

// --- SETTINGS PERSISTENCE ---

export const saveSettings = (settings: Partial<AppSettings>): void => {
    try {
        const current = loadSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error("Failed to save settings", e);
    }
};

export const loadSettings = (): AppSettings => {
    const DEFAULT_SETTINGS: AppSettings = {
        fontSize: 'normal',
        playbackSpeed: 1.0,
        swipeAutoplay: true
    };
    try {
        const str = localStorage.getItem(SETTINGS_KEY);
        if (!str) return DEFAULT_SETTINGS;
        return { ...DEFAULT_SETTINGS, ...JSON.parse(str) };
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
};

// --- AUDIO CACHE PERSISTENCE ---
// We use a separate storage key because audio data is large

export const saveAudioCache = (cacheMap: Map<string, string>): void => {
    try {
        // Convert Map to Object
        const obj = Object.fromEntries(cacheMap);
        const str = JSON.stringify(obj);
        localStorage.setItem(AUDIO_CACHE_KEY, str);
    } catch (e) {
        console.warn("Failed to save audio cache (likely quota exceeded)", e);
        // Optional: Implement Least Recently Used (LRU) clearing strategy here if needed
    }
};

export const loadAudioCache = (): Map<string, string> => {
    try {
        const str = localStorage.getItem(AUDIO_CACHE_KEY);
        if (!str) return new Map();
        const obj = JSON.parse(str);
        return new Map(Object.entries(obj));
    } catch (e) {
        console.error("Failed to load audio cache", e);
        return new Map();
    }
};

// --- IMPORT / EXPORT FULL BACKUP ---

export const getRawDataForExport = (lang: Language, currentAudioCache?: Map<string, string>): string => {
    const vocab = loadVocabularyData(lang);
    const news = loadNewsData(lang);
    const settings = loadSettings();
    
    // CRITICAL FIX: Use the provided in-memory cache if available.
    // This ensures we export ALL audio data even if localStorage was full/failed to save.
    const audioCacheMap = currentAudioCache || loadAudioCache();
    const audioCacheObj = Object.fromEntries(audioCacheMap);

    const backup: FullBackup = {
        version: 2,
        lang: lang,
        vocab: vocab,
        news: news,
        audioCache: audioCacheObj,
        settings: settings,
        timestamp: Date.now()
    };

    return JSON.stringify(backup, null, 2);
};

export const importDataFromJson = (jsonString: string, lang: Language): { success: boolean, audioCache?: Map<string, string> } => {
    try {
        const parsed = JSON.parse(jsonString);
        
        // Check format version
        if (Array.isArray(parsed)) {
            // OLD FORMAT (Just array of words)
            if (parsed.length > 0 && (!parsed[0].target && !parsed[0].french)) return { success: false };
            
            // Standardize old format if needed
            const standardized = parsed.map((w: any) => ({
                 ...w,
                 target: w.target || w.french,
                 example: {
                     ...w.example,
                     target: w.example?.target || w.example?.french || w.example
                 }
            }));
            
            const merged = appendVocabulary(standardized, lang);
            saveVocabularyData(merged, lang);
            return { success: true };
        } 
        else if (parsed.version && parsed.vocab) {
            // NEW FULL BACKUP FORMAT
            const backup = parsed as FullBackup;
            
            // 1. Merge Vocab
            if (backup.vocab) {
                 appendVocabulary(backup.vocab, lang);
            }

            // 2. Merge News
            if (backup.news) {
                 appendNewsData(backup.news, lang);
            }

            // 3. Merge Audio Cache
            // We start with what is currently on disk (if any)
            const mergedCache = loadAudioCache();
            
            if (backup.audioCache) {
                 Object.entries(backup.audioCache).forEach(([key, val]) => {
                     mergedCache.set(key, val as string);
                 });
                 
                 // Try to save to disk (Might fail if quota exceeded, but that's okay for now)
                 saveAudioCache(mergedCache);
            }

            // 4. Merge Settings
            if (backup.settings) {
                saveSettings(backup.settings);
            }

            // Return success AND the merged cache so App can update memory immediately
            return { success: true, audioCache: mergedCache };
        }
        
        return { success: false };
    } catch (e) {
        console.error("Invalid JSON for import", e);
        return { success: false };
    }
};