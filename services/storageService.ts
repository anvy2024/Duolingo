import { VocabularyWord, Language, NewsArticle } from "../types";
import { FontSize } from "../App";

const getStorageKey = (lang: Language) => `vocab_data_${lang}_v1`;
const getNewsStorageKey = (lang: Language) => `news_data_${lang}_v1`;
const SETTINGS_KEY = 'app_settings_v1';

// Danh sách các ngôn ngữ hỗ trợ để quét khi backup
export const SUPPORTED_LANGUAGES: Language[] = ['fr', 'en', 'zh', 'es'];

const AUDIO_DB_NAME = 'DuolingoAI_AudioDB';
const AUDIO_STORE_NAME = 'audio_snippets';
const DB_VERSION = 1;

const openAudioDB = (): Promise<IDBDatabase> => {
    if (!('indexedDB' in window)) return Promise.reject("IndexedDB not supported");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUDIO_DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) db.createObjectStore(AUDIO_STORE_NAME);
        };
    });
};

export const saveAudioSnippet = async (key: string, base64Url: string) => {
    try {
        const db = await openAudioDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
            const store = tx.objectStore(AUDIO_STORE_NAME);
            store.put(base64Url, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error("DB Save Err", e); }
};

export const deleteAudioSnippet = async (key: string) => {
    try {
        const db = await openAudioDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
            const store = tx.objectStore(AUDIO_STORE_NAME);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error("DB Delete Err", e); }
}

export const loadAllAudioFromDB = async (): Promise<Map<string, string>> => {
    try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE_NAME, 'readonly');
            const store = tx.objectStore(AUDIO_STORE_NAME);
            const map = new Map<string, string>();
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) { map.set(cursor.key as string, cursor.value as string); cursor.continue(); } 
                else resolve(map);
            };
            cursorReq.onerror = () => reject(cursorReq.error);
        });
    } catch (e) { return new Map(); }
};

export const saveBatchAudioToDB = async (entries: [string, string][]) => {
    if (entries.length === 0) return;
    const db = await openAudioDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE_NAME);
        entries.forEach(([key, val]) => store.put(val, key));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export interface AppSettings {
    fontSize: FontSize;
    playbackSpeed: number;
    swipeAutoplay: boolean;
    loopAudio: boolean;
    autoPlayDelay: number;
    autoPlayExample: boolean;
}

// Cấu trúc backup toàn cục mới
export interface FullSystemBackup {
    version: number;
    type: 'GLOBAL_BACKUP';
    timestamp: number;
    settings: AppSettings;
    audioCache: Record<string, string>;
    data: {
        [key in Language]?: {
            vocab: VocabularyWord[];
            news: NewsArticle[];
        }
    };
}

// --- DATA FIXING LOGIC ---
const fixWordData = (w: any, index: number): VocabularyWord => {
    const id = w.id || `repaired_id_${Date.now()}_${index}`;
    let target = w.target || w.french || w.english || w.text || 'Unknown Word';
    let vietnamese = w.vietnamese || 'Chưa có nghĩa';
    let example = w.example || {};
    let exTarget = example.target || example.french || example.english || example.text || target;
    let exViet = example.vietnamese || vietnamese;
    
    return {
        id: id,
        target: target,
        vietnamese: vietnamese,
        ipa: w.ipa || '',
        viet_pronunciation: w.viet_pronunciation || '',
        example: {
            target: exTarget,
            vietnamese: exViet,
            viet_pronunciation: example.viet_pronunciation || ''
        },
        learnedAt: w.learnedAt || Date.now(),
        mastered: !!w.mastered,
        isFavorite: !!w.isFavorite,
        category: w.category || 'general'
    };
};

export const saveVocabularyData = (words: VocabularyWord[], lang: Language): void => {
    try { localStorage.setItem(getStorageKey(lang), JSON.stringify(words)); } catch (e) { console.error(e); }
};

export const loadVocabularyData = (lang: Language): VocabularyWord[] => {
    try {
        const key = getStorageKey(lang);
        let jsonString = localStorage.getItem(key);
        if (!jsonString || jsonString === '[]') {
            if (lang === 'fr') {
                const oldData = localStorage.getItem('french_vocab_a1_data_json');
                if (oldData && oldData !== '[]') jsonString = oldData;
            }
        }
        if (!jsonString) return [];
        let parsed: any[] = JSON.parse(jsonString);
        if (!Array.isArray(parsed)) return [];
        const repairedData = parsed.map((w, i) => fixWordData(w, i));
        const needsSave = repairedData.some((w, i) => !parsed[i].id || !parsed[i].target);
        if (needsSave) {
            saveVocabularyData(repairedData, lang);
        }
        return repairedData;
    } catch (error) {
        console.error("Failed load", error);
        return [];
    }
};

export const resetToDefaults = (lang: Language): VocabularyWord[] => {
    saveVocabularyData([], lang);
    return [];
}

export const appendVocabulary = (newWords: VocabularyWord[], lang: Language): VocabularyWord[] => {
    const current = loadVocabularyData(lang);
    const distinct = newWords.filter(nw => !current.some(ex => ex.target.toLowerCase() === nw.target.toLowerCase()));
    const updated = [...current, ...distinct];
    saveVocabularyData(updated, lang);
    return updated;
};

export const updateWordStatus = (id: string, updates: Partial<VocabularyWord>, lang: Language): VocabularyWord[] => {
    const current = loadVocabularyData(lang);
    const idx = current.findIndex(w => w.id === id);
    if (idx !== -1) { current[idx] = { ...current[idx], ...updates }; saveVocabularyData(current, lang); }
    return current;
};

export const editVocabularyWord = (id: string, word: VocabularyWord, lang: Language): VocabularyWord[] => {
    const current = loadVocabularyData(lang);
    const idx = current.findIndex(w => w.id === id);
    if (idx !== -1) { current[idx] = { ...current[idx], ...word, id }; saveVocabularyData(current, lang); }
    return current;
};

export const removeVocabularyWord = (id: string, lang: Language): VocabularyWord[] => {
    const current = loadVocabularyData(lang);
    const updated = current.filter(w => w.id !== id);
    saveVocabularyData(updated, lang);
    return updated;
}

// --- NEWS & SETTINGS ---
export const loadNewsData = (lang: Language): NewsArticle[] => {
    try { return JSON.parse(localStorage.getItem(getNewsStorageKey(lang)) || '[]'); } catch (e) { return []; }
};
export const saveNewsData = (articles: NewsArticle[], lang: Language) => localStorage.setItem(getNewsStorageKey(lang), JSON.stringify(articles));
export const appendNewsData = (newArticles: NewsArticle[], lang: Language) => {
    const current = loadNewsData(lang);
    const updated = [...newArticles.filter(na => !current.some(ex => ex.title === na.title)), ...current];
    saveNewsData(updated, lang);
    return updated;
};
export const deleteNewsArticle = (id: string, lang: Language) => {
    const updated = loadNewsData(lang).filter(a => a.id !== id);
    saveNewsData(updated, lang);
    return updated;
};

export const saveSettings = (settings: Partial<AppSettings>) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...settings }));
export const loadSettings = (): AppSettings => {
    try { return { fontSize: 'normal', playbackSpeed: 1.0, swipeAutoplay: true, loopAudio: false, autoPlayDelay: 2000, autoPlayExample: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } 
    catch (e) { return { fontSize: 'normal', playbackSpeed: 1.0, swipeAutoplay: true, loopAudio: false, autoPlayDelay: 2000, autoPlayExample: true }; }
};

// --- GLOBAL EXPORT / IMPORT FUNCTIONS ---

// 1. Xuất toàn bộ dữ liệu (Global Backup)
export const exportFullSystemBackup = async (): Promise<string> => {
    let audioCacheMap = new Map<string, string>();
    try { audioCacheMap = await loadAllAudioFromDB(); } catch(e) {}
    
    // Gom dữ liệu từ tất cả ngôn ngữ
    const allData: any = {};
    
    SUPPORTED_LANGUAGES.forEach(lang => {
        allData[lang] = {
            vocab: loadVocabularyData(lang), // Tải và sửa lỗi luôn
            news: loadNewsData(lang)
        };
    });

    const backup: FullSystemBackup = {
        version: 3,
        type: 'GLOBAL_BACKUP',
        timestamp: Date.now(),
        settings: loadSettings(),
        audioCache: Object.fromEntries(audioCacheMap),
        data: allData
    };

    return JSON.stringify(backup);
};

// 2. Nhập dữ liệu (Smart Import)
export const importFullSystemBackup = async (json: string, currentFallbackLang: Language): Promise<{ success: boolean, audioCache?: Map<string, string>, message?: string }> => {
    try {
        const parsed = JSON.parse(json);
        
        // CASE A: GLOBAL BACKUP (File mới)
        if (parsed.type === 'GLOBAL_BACKUP' || (parsed.version >= 3 && parsed.data)) {
            // Khôi phục Cài đặt
            if (parsed.settings) saveSettings(parsed.settings);
            
            // Khôi phục dữ liệu từng ngôn ngữ
            const languagesFound = Object.keys(parsed.data) as Language[];
            languagesFound.forEach(lang => {
                if (parsed.data[lang]) {
                    const vocab = parsed.data[lang].vocab || [];
                    const news = parsed.data[lang].news || [];
                    
                    // Sửa lỗi dữ liệu trước khi lưu
                    const fixedVocab = vocab.map((w: any, i: number) => fixWordData(w, i));
                    
                    // Gộp dữ liệu (Append Unique)
                    appendVocabulary(fixedVocab, lang);
                    appendNewsData(news, lang);
                }
            });

            // Khôi phục Audio Cache
            let cache = undefined;
            if (parsed.audioCache) {
                 cache = new Map(Object.entries(parsed.audioCache));
                 saveBatchAudioToDB(Object.entries(parsed.audioCache) as [string,string][]);
            }
            
            return { success: true, audioCache: cache as Map<string, string>, message: `Restored data for: ${languagesFound.join(', ').toUpperCase()}` };
        } 
        
        // CASE B: LEGACY BACKUP (File cũ chỉ có 1 ngôn ngữ)
        else if (parsed.vocab || Array.isArray(parsed)) {
             // Dùng hàm importDataFromJson cũ, nhưng wrap lại ở đây cho gọn
             const result = await importDataFromJson(json, currentFallbackLang);
             return { ...result, message: `Legacy backup restored to ${currentFallbackLang.toUpperCase()}` };
        }
        
        return { success: false, message: "Unknown file format" };
    } catch (e) { 
        console.error(e);
        return { success: false, message: "Invalid JSON file" }; 
    }
};

// Legacy import helper (kept for internal use by case B above)
export const importDataFromJson = async (json: string, lang: Language): Promise<{ success: boolean, audioCache?: Map<string, string> }> => {
    try {
        const parsed = JSON.parse(json);
        if (parsed.vocab || Array.isArray(parsed)) {
             const words = parsed.vocab || parsed;
             const fixedWords = words.map((w: any, i: number) => fixWordData(w, i));
             appendVocabulary(fixedWords, lang);
             
             if (parsed.audioCache) {
                 const cache = new Map(Object.entries(parsed.audioCache));
                 saveBatchAudioToDB(Object.entries(parsed.audioCache) as [string,string][]);
                 return { success: true, audioCache: cache as Map<string, string> };
             }
             return { success: true };
        }
        return { success: false };
    } catch (e) { return { success: false }; }
};