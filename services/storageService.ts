import { VocabularyWord, Language, NewsArticle } from "../types";
import { FontSize } from "../App";

const getStorageKey = (lang: Language) => `vocab_data_${lang}_v1`;
const getNewsStorageKey = (lang: Language) => `news_data_${lang}_v1`;
const SETTINGS_KEY = 'app_settings_v1';

// CHÍNH XÁC: Danh sách các ngôn ngữ được hỗ trợ để phân loại khi Backup/Restore
export const SUPPORTED_LANGUAGES: Language[] = ['fr', 'en', 'zh', 'es'];

const AUDIO_DB_NAME = 'DuolingoAI_AudioDB';
const AUDIO_STORE_NAME = 'audio_snippets';
const DB_VERSION = 1;

// --- AUDIO DB FUNCTIONS ---
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

// --- SETTINGS ---
export interface AppSettings {
    fontSize: FontSize;
    playbackSpeed: number;
    swipeAutoplay: boolean;
    loopAudio: boolean;
    autoPlayDelay: number;
    autoPlayExample: boolean;
}

export const saveSettings = (settings: Partial<AppSettings>) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...settings }));
export const loadSettings = (): AppSettings => {
    try { return { fontSize: 'normal', playbackSpeed: 1.0, swipeAutoplay: true, loopAudio: false, autoPlayDelay: 2000, autoPlayExample: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } 
    catch (e) { return { fontSize: 'normal', playbackSpeed: 1.0, swipeAutoplay: true, loopAudio: false, autoPlayDelay: 2000, autoPlayExample: true }; }
};

// --- DATA STRUCTURES ---

// Cấu trúc file backup toàn hệ thống
export interface FullSystemBackup {
    version: number;
    type: 'GLOBAL_BACKUP';
    timestamp: number;
    settings: AppSettings;
    audioCache: Record<string, string>;
    // Dữ liệu được chia rõ ràng theo từng key ngôn ngữ
    data: {
        [key in Language]?: {
            vocab: VocabularyWord[];
            news: NewsArticle[];
        }
    };
}

// --- CORE DATA FUNCTIONS ---

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
        // Migration logic for old French key
        if ((!jsonString || jsonString === '[]') && lang === 'fr') {
            const oldData = localStorage.getItem('french_vocab_a1_data_json');
            if (oldData && oldData !== '[]') jsonString = oldData;
        }

        if (!jsonString) return [];
        let parsed: any[] = JSON.parse(jsonString);
        if (!Array.isArray(parsed)) return [];
        
        // Auto-repair on load
        return parsed.map((w, i) => fixWordData(w, i));
    } catch (error) {
        console.error("Failed load", error);
        return [];
    }
};

export const resetToDefaults = (lang: Language): VocabularyWord[] => {
    saveVocabularyData([], lang);
    return [];
}

// Hàm này dùng khi GENERATE từ mới (chỉ thêm từ chưa có)
export const appendVocabulary = (newWords: VocabularyWord[], lang: Language): VocabularyWord[] => {
    const current = loadVocabularyData(lang);
    const distinct = newWords.filter(nw => !current.some(ex => ex.target.toLowerCase() === nw.target.toLowerCase()));
    const updated = [...current, ...distinct];
    saveVocabularyData(updated, lang);
    return updated;
};

// Hàm này dùng khi RESTORE (Cập nhật từ cũ + Thêm từ mới)
export const mergeVocabularyData = (incomingWords: VocabularyWord[], lang: Language): void => {
    const current = loadVocabularyData(lang);
    
    // Map để tra cứu nhanh theo ID và Target (Text)
    const idMap = new Map(current.map(w => [w.id, w]));
    const targetMap = new Map(current.map(w => [w.target.toLowerCase().trim(), w]));

    incomingWords.forEach(incoming => {
        // 1. Nếu trùng ID -> Cập nhật (Restore đè lên)
        if (idMap.has(incoming.id)) {
            const existing = idMap.get(incoming.id)!;
            Object.assign(existing, incoming); // Ghi đè thông tin từ backup
        } 
        // 2. Nếu không trùng ID nhưng trùng Text -> Cập nhật nội dung (giữ ID cũ hoặc mới tùy ý, ở đây ta update content)
        else if (targetMap.has(incoming.target.toLowerCase().trim())) {
            const existing = targetMap.get(incoming.target.toLowerCase().trim())!;
            // Merge các trường quan trọng, giữ lại trạng thái mastered/favorite nếu muốn, 
            // nhưng Restore thường ưu tiên file backup. Ta sẽ ghi đè tất cả.
            Object.assign(existing, incoming, { id: existing.id }); // Giữ ID cũ để tránh lỗi React key
        }
        // 3. Nếu mới hoàn toàn -> Thêm vào danh sách
        else {
            current.push(incoming);
        }
    });

    saveVocabularyData(current, lang);
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

// --- NEWS HANDLING ---
export const loadNewsData = (lang: Language): NewsArticle[] => {
    try { return JSON.parse(localStorage.getItem(getNewsStorageKey(lang)) || '[]'); } catch (e) { return []; }
};
export const saveNewsData = (articles: NewsArticle[], lang: Language) => localStorage.setItem(getNewsStorageKey(lang), JSON.stringify(articles));

export const appendNewsData = (newArticles: NewsArticle[], lang: Language) => {
    const current = loadNewsData(lang);
    // Filter duplicates by Title
    const distinct = newArticles.filter(na => !current.some(ex => ex.title === na.title));
    const updated = [...distinct, ...current];
    saveNewsData(updated, lang);
    return updated;
};

// Hàm merge cho News khi Restore
export const mergeNewsData = (incoming: NewsArticle[], lang: Language) => {
    const current = loadNewsData(lang);
    const map = new Map(current.map(n => [n.id, n]));
    
    incoming.forEach(inc => {
        if (map.has(inc.id)) {
            Object.assign(map.get(inc.id)!, inc);
        } else {
            current.unshift(inc);
        }
    });
    saveNewsData(current, lang);
};

export const deleteNewsArticle = (id: string, lang: Language) => {
    const updated = loadNewsData(lang).filter(a => a.id !== id);
    saveNewsData(updated, lang);
    return updated;
};


// --- GLOBAL EXPORT / IMPORT LOGIC (STRICT) ---

// 1. Xuất toàn bộ: Quét qua danh sách SUPPORTED_LANGUAGES để lấy đúng dữ liệu
export const exportFullSystemBackup = async (): Promise<string> => {
    let audioCacheMap = new Map<string, string>();
    try { audioCacheMap = await loadAllAudioFromDB(); } catch(e) {}
    
    // Container chứa dữ liệu phân theo ngôn ngữ
    const allData: FullSystemBackup['data'] = {};
    
    // QUAN TRỌNG: Chỉ lấy đúng key của ngôn ngữ được hỗ trợ
    SUPPORTED_LANGUAGES.forEach(lang => {
        allData[lang] = {
            vocab: loadVocabularyData(lang),
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

// 2. Nhập toàn bộ: Đọc file và phân phối về đúng ngôn ngữ
export const importFullSystemBackup = async (json: string): Promise<{ success: boolean, audioCache?: Map<string, string>, message?: string }> => {
    try {
        const parsed = JSON.parse(json);
        
        // Kiểm tra format mới (Global Backup)
        if (parsed.type === 'GLOBAL_BACKUP' || (parsed.version >= 3 && parsed.data)) {
            
            // 1. Khôi phục Settings
            if (parsed.settings) saveSettings(parsed.settings);
            
            // 2. Khôi phục Dữ liệu Ngôn ngữ (STRICT LOOP)
            // Ta chỉ duyệt qua các ngôn ngữ mà App hỗ trợ để đảm bảo an toàn
            let restoredLangs: string[] = [];
            
            SUPPORTED_LANGUAGES.forEach(lang => {
                // Kiểm tra xem trong file backup có dữ liệu cho ngôn ngữ này không
                if (parsed.data && parsed.data[lang]) {
                    const langData = parsed.data[lang];
                    
                    // Xử lý Vocab
                    if (langData.vocab && Array.isArray(langData.vocab)) {
                        const fixedVocab = langData.vocab.map((w: any, i: number) => fixWordData(w, i));
                        mergeVocabularyData(fixedVocab, lang); // Dùng hàm MERGE để cập nhật đúng kho
                    }

                    // Xử lý News
                    if (langData.news && Array.isArray(langData.news)) {
                        mergeNewsData(langData.news, lang);
                    }
                    
                    restoredLangs.push(lang.toUpperCase());
                }
            });

            // 3. Khôi phục Audio Cache
            let cache = undefined;
            if (parsed.audioCache) {
                 cache = new Map(Object.entries(parsed.audioCache));
                 saveBatchAudioToDB(Object.entries(parsed.audioCache) as [string,string][]);
            }
            
            if (restoredLangs.length === 0) {
                return { success: true, message: "Backup valid but no language data found to restore." };
            }
            
            return { 
                success: true, 
                audioCache: cache as Map<string, string>, 
                message: `Restored: ${restoredLangs.join(', ')}` 
            };
        } 
        
        // Hỗ trợ file cũ (Legacy) - Nếu file không có cấu trúc global, báo lỗi hoặc yêu cầu dùng file mới
        // Tuy nhiên, để thân thiện, ta có thể thử import vào 'fr' mặc định nếu người dùng muốn, 
        // nhưng tốt nhất là return false để bắt buộc dùng chuẩn mới cho an toàn.
        return { success: false, message: "Old backup file format. Please use a new Global Backup." };

    } catch (e) { 
        console.error(e);
        return { success: false, message: "Invalid or Corrupted JSON file" }; 
    }
};
