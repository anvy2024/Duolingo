import { VocabularyWord, Language, NewsArticle } from "../types";
import { FontSize } from "../App";

const getStorageKey = (lang: Language) => `vocab_data_${lang}_v1`;
const getNewsStorageKey = (lang: Language) => `news_data_${lang}_v1`;
const SETTINGS_KEY = 'app_settings_v1';

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
    githubUrl: string;
    githubToken: string;
}

export const saveSettings = (settings: Partial<AppSettings>) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...settings }));
export const loadSettings = (): AppSettings => {
    const defaults: AppSettings = { 
        fontSize: 'normal', 
        playbackSpeed: 1.0, 
        swipeAutoplay: true, 
        loopAudio: false, 
        autoPlayDelay: 2000, 
        autoPlayExample: true,
        githubUrl: '',
        githubToken: ''
    };
    try { 
        return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; 
    } catch (e) { return defaults; }
};

// --- DATA STRUCTURES ---
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

// --- GITHUB SYNC FUNCTIONS ---

const utf8_to_b64 = (str: string) => {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    console.error("Encoding error:", e);
    throw new Error("Cannot encode data. File too large or invalid characters.");
  }
}

// 1. Load from GitHub (Using Raw URL)
export const loadFromGitHub = async (rawUrl: string): Promise<string> => {
    const cacheBuster = `?t=${Date.now()}`;
    try {
        const response = await fetch(rawUrl + cacheBuster);
        if (!response.ok) {
            throw new Error(`GitHub Load Error (${response.status}): ${response.statusText}`);
        }
        return await response.text();
    } catch (e: any) {
        throw new Error("Network Error: " + e.message);
    }
};

// 2. Save to GitHub (Using API)
export const saveToGitHub = async (rawUrl: string, token: string, content: string): Promise<void> => {
    // Parse URL to get Owner, Repo, Path, Branch
    // Format: https://raw.githubusercontent.com/:owner/:repo/:branch/:path
    const regex = /raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/;
    const match = rawUrl.trim().match(regex);
    
    if (!match) {
        throw new Error("Invalid GitHub Raw URL format. Must be raw.githubusercontent.com/USER/REPO/BRANCH/PATH");
    }
    
    const owner = match[1];
    const repo = match[2];
    const branch = match[3];
    const path = match[4];
    
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // Set Auth Header - 'token' prefix is standard for classic PATs starting with ghp_
    const cleanToken = token.trim();
    const authHeader = cleanToken.startsWith('ghp_') ? `token ${cleanToken}` : `Bearer ${cleanToken}`;

    // Step A: Get SHA of existing file (Required for Update)
    let sha = "";
    try {
        const getRes = await fetch(apiUrl + `?ref=${branch}`, {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (getRes.status === 401) {
            throw new Error("INVALID TOKEN: Access denied (401). Please generate a new GitHub Token with 'repo' scope.");
        }
        
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        } else if (getRes.status !== 404) {
            // 404 is fine (file doesn't exist yet), anything else is an error
            const errText = await getRes.text();
            throw new Error(`GitHub Error (${getRes.status}): ${errText}`);
        }
    } catch (e: any) {
        throw new Error(e.message || "Failed to connect to GitHub API.");
    }

    // Step B: Create/Update File
    const body = {
        message: `Update via Duolingo AI (${new Date().toLocaleString()})`,
        content: utf8_to_b64(content),
        branch: branch,
        ...(sha ? { sha } : {})
    };

    try {
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!putRes.ok) {
            const err = await putRes.json().catch(() => ({}));
            const errMsg = err.message || putRes.statusText;
            if (putRes.status === 409) throw new Error("Conflict (409). File changed remotely. Try Pulling first.");
            if (putRes.status === 422) throw new Error("Unprocessable (422). File might be too large or invalid.");
            if (putRes.status === 401) throw new Error("Unauthorized (401). Token invalid.");
            throw new Error(`Upload Failed (${putRes.status}): ${errMsg}`);
        }
    } catch (e: any) {
        throw new Error(e.message || "Network error during upload.");
    }
};

// --- CORE DATA FUNCTIONS ---
const fixWordData = (w: any, index: number): VocabularyWord => {
    const id = w.id || `repaired_id_${Date.now()}_${index}`;
    let target = w.target || w.french || w.english || w.text || 'Unknown Word';
    let vietnamese = w.vietnamese || 'Chưa có nghĩa';
    let example = w.example || {};
    let exTarget = example.target || example.french || example.english || example.text || target;
    let exViet = example.vietnamese || vietnamese;
    return { id, target, vietnamese, ipa: w.ipa || '', viet_pronunciation: w.viet_pronunciation || '', example: { target: exTarget, vietnamese: exViet, viet_pronunciation: example.viet_pronunciation || '' }, learnedAt: w.learnedAt || Date.now(), mastered: !!w.mastered, isFavorite: !!w.isFavorite, category: w.category || 'general' };
};

export const saveVocabularyData = (words: VocabularyWord[], lang: Language): void => { try { localStorage.setItem(getStorageKey(lang), JSON.stringify(words)); } catch (e) { console.error(e); } };
export const loadVocabularyData = (lang: Language): VocabularyWord[] => {
    try {
        const key = getStorageKey(lang);
        let jsonString = localStorage.getItem(key);
        if ((!jsonString || jsonString === '[]') && lang === 'fr') { const old = localStorage.getItem('french_vocab_a1_data_json'); if (old && old !== '[]') jsonString = old; }
        if (!jsonString) return [];
        let parsed: any[] = JSON.parse(jsonString);
        if (!Array.isArray(parsed)) return [];
        const repaired = parsed.map((w, i) => fixWordData(w, i));
        if (repaired.some((w, i) => !parsed[i].id || !parsed[i].target)) saveVocabularyData(repaired, lang);
        return repaired;
    } catch (error) { console.error("Failed load", error); return []; }
};
export const resetToDefaults = (lang: Language): VocabularyWord[] => { saveVocabularyData([], lang); return []; }
export const appendVocabulary = (newWords: VocabularyWord[], lang: Language): VocabularyWord[] => {
    const current = loadVocabularyData(lang);
    const distinct = newWords.filter(nw => !current.some(ex => ex.target.toLowerCase() === nw.target.toLowerCase()));
    const updated = [...current, ...distinct];
    saveVocabularyData(updated, lang);
    return updated;
};
export const mergeVocabularyData = (incomingWords: VocabularyWord[], lang: Language): void => {
    const current = loadVocabularyData(lang);
    const idMap = new Map(current.map(w => [w.id, w]));
    const targetMap = new Map(current.map(w => [w.target.toLowerCase().trim(), w]));
    incomingWords.forEach(incoming => {
        if (idMap.has(incoming.id)) Object.assign(idMap.get(incoming.id)!, incoming);
        else if (targetMap.has(incoming.target.toLowerCase().trim())) Object.assign(targetMap.get(incoming.target.toLowerCase().trim())!, incoming, { id: targetMap.get(incoming.target.toLowerCase().trim())!.id });
        else current.push(incoming);
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
export const loadNewsData = (lang: Language): NewsArticle[] => { try { return JSON.parse(localStorage.getItem(getNewsStorageKey(lang)) || '[]'); } catch (e) { return []; } };
export const saveNewsData = (articles: NewsArticle[], lang: Language) => localStorage.setItem(getNewsStorageKey(lang), JSON.stringify(articles));
export const appendNewsData = (newArticles: NewsArticle[], lang: Language) => { const current = loadNewsData(lang); const distinct = newArticles.filter(na => !current.some(ex => ex.title === na.title)); const updated = [...distinct, ...current]; saveNewsData(updated, lang); return updated; };
export const mergeNewsData = (incoming: NewsArticle[], lang: Language) => { const current = loadNewsData(lang); const map = new Map(current.map(n => [n.id, n])); incoming.forEach(inc => { if (map.has(inc.id)) Object.assign(map.get(inc.id)!, inc); else current.unshift(inc); }); saveNewsData(current, lang); };
export const deleteNewsArticle = (id: string, lang: Language) => { const updated = loadNewsData(lang).filter(a => a.id !== id); saveNewsData(updated, lang); return updated; };

export const exportFullSystemBackup = async (includeAudio: boolean = true): Promise<string> => {
    let audioCacheMap = new Map<string, string>();
    try { audioCacheMap = await loadAllAudioFromDB(); } catch(e) {}
    const allData: FullSystemBackup['data'] = {};
    SUPPORTED_LANGUAGES.forEach(lang => { allData[lang] = { vocab: loadVocabularyData(lang), news: loadNewsData(lang) }; });
    const backup: FullSystemBackup = { version: 3, type: 'GLOBAL_BACKUP', timestamp: Date.now(), settings: loadSettings(), audioCache: Object.fromEntries(audioCacheMap), data: allData };
    return JSON.stringify(backup, null, 2);
};
export const importFullSystemBackup = async (json: string, legacyLangHint?: Language): Promise<{ success: boolean, audioCache?: Map<string, string>, message?: string }> => {
    try {
        const parsed = JSON.parse(json);
        if (parsed.type === 'GLOBAL_BACKUP' || (parsed.version >= 3 && parsed.data)) {
            if (parsed.settings) saveSettings(parsed.settings);
            let restoredLangs: string[] = [];
            SUPPORTED_LANGUAGES.forEach(lang => {
                if (parsed.data && parsed.data[lang]) {
                    const langData = parsed.data[lang];
                    if (langData.vocab) { const fixed = langData.vocab.map((w: any, i: number) => fixWordData(w, i)); mergeVocabularyData(fixed, lang); }
                    if (langData.news) mergeNewsData(langData.news, lang);
                    restoredLangs.push(lang.toUpperCase());
                }
            });
            let cache = undefined;
            if (parsed.audioCache && Object.keys(parsed.audioCache).length > 0) { 
                cache = new Map(Object.entries(parsed.audioCache)); 
                saveBatchAudioToDB(Object.entries(parsed.audioCache) as [string,string][]); 
            }
            return { success: true, audioCache: cache as Map<string, string>, message: `Restored: ${restoredLangs.join(', ')}` };
        } 
        if (Array.isArray(parsed) && legacyLangHint) { const fixed = parsed.map((w: any, i: number) => fixWordData(w, i)); mergeVocabularyData(fixed, legacyLangHint); return { success: true, message: `Restored legacy data into ${legacyLangHint.toUpperCase()}` }; }
        return { success: false, message: "Invalid file format." };
    } catch (e) { console.error(e); return { success: false, message: "Invalid JSON file" }; }
};