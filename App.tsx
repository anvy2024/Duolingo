import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, VocabularyWord, Language, NewsArticle } from './types';
import { generateVocabularyBatch, getHighQualityAudio, GenerationTopic, generateCanadianNews } from './services/geminiService';
import { loadVocabularyData, appendVocabulary, updateWordStatus, removeVocabularyWord, importFullSystemBackup, loadNewsData, appendNewsData, deleteNewsArticle, editVocabularyWord, loadSettings, saveSettings, loadAllAudioFromDB, saveAudioSnippet, deleteAudioSnippet, resetToDefaults, loadFromGitHub, saveToGitHub, exportFullSystemBackup } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { StudyList } from './components/StudyList';
import { Flashcard } from './components/Flashcard';
import { VocabularyList, FilterType } from './components/VocabularyList';
import { NewsReader } from './components/NewsReader';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, X, Download, Upload, AlertTriangle, Globe, BookOpen, ArrowRight, LogOut, Volume2, VolumeX, Type, Lock, KeyRound, Repeat, Clock, Sparkles, RefreshCcw, Cloud, Link, Github, Check, AlertCircle, Save } from 'lucide-react';
import { TRANSLATIONS } from './constants/translations';

export type FontSize = 'normal' | 'large' | 'huge';

export default function App() {
  // ... (State setup) ...
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('duo_ai_auth_v1') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.LANGUAGE_SELECT);
  const [vocab, setVocab] = useState<VocabularyWord[]>([]);
  const [currentBatch, setCurrentBatch] = useState<VocabularyWord[]>([]);
  const [studyListTitle, setStudyListTitle] = useState<string>('');
  const [initialFilter, setInitialFilter] = useState<FilterType>('ALL');
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const initialSettings = loadSettings();
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSettings.playbackSpeed);
  const [swipeAutoplay, setSwipeAutoplay] = useState(initialSettings.swipeAutoplay);
  const [fontSize, setFontSize] = useState<FontSize>(initialSettings.fontSize); 
  const [loopAudio, setLoopAudio] = useState(initialSettings.loopAudio ?? false); 
  const [autoPlayDelay, setAutoPlayDelay] = useState(initialSettings.autoPlayDelay ?? 2000); 
  const [autoPlayExample, setAutoPlayExample] = useState(initialSettings.autoPlayExample ?? true); 
  
  // GitHub / Cloud Sync State
  const [githubUrl, setGithubUrl] = useState(initialSettings.githubUrl || '');
  const [githubToken, setGithubToken] = useState(initialSettings.githubToken || '');
  
  // NEW: Sync Status State for UI Feedback
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(''); 
  const [aiAudioLoading, setAiAudioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
      const initAudio = async () => {
          try { audioCache.current = await loadAllAudioFromDB(); } catch (e) {}
      };
      initAudio();
  }, []);

  useEffect(() => {
      saveSettings({ fontSize, playbackSpeed, swipeAutoplay, loopAudio, autoPlayDelay, autoPlayExample, githubUrl, githubToken });
  }, [fontSize, playbackSpeed, swipeAutoplay, loopAudio, autoPlayDelay, autoPlayExample, githubUrl, githubToken]);

  const refreshData = useCallback(() => {
      if (!selectedLang) return;
      const savedVocab = loadVocabularyData(selectedLang);
      setVocab(savedVocab);
      setNewsArticles(loadNewsData(selectedLang));
      const settings = loadSettings();
      setFontSize(settings.fontSize); setPlaybackSpeed(settings.playbackSpeed);
      setSwipeAutoplay(settings.swipeAutoplay); setLoopAudio(settings.loopAudio ?? false);
      setAutoPlayDelay(settings.autoPlayDelay ?? 2000); setAutoPlayExample(settings.autoPlayExample ?? true);
      setGithubUrl(settings.githubUrl || ''); setGithubToken(settings.githubToken || '');
  }, [selectedLang]);

  useEffect(() => {
    if (selectedLang) { refreshData(); setMode(AppMode.DASHBOARD); } 
    else { setMode(AppMode.LANGUAGE_SELECT); }
  }, [selectedLang, refreshData]);

  // ... (Audio Logic unchanged) ...
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices;
    if (!currentAudioRef.current) { currentAudioRef.current = new Audio(); currentAudioRef.current.preload = 'auto'; }
    return () => { if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.src = ""; } if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current); }
  }, []);
  const playAudioSource = (url: string, speed: number, onEnd?: () => void) => { window.speechSynthesis.cancel(); if (!currentAudioRef.current) currentAudioRef.current = new Audio(); const audio = currentAudioRef.current; audio.onended = null; audio.onerror = null; audio.pause(); audio.currentTime = 0; audio.src = url; audio.playbackRate = speed; if (onEnd) { const handleEnd = () => { audio.onended = null; onEnd(); }; audio.onended = handleEnd; } audio.play().catch(e => { if (onEnd) onEnd(); }); };
  const toggleSpeed = () => { setPlaybackSpeed(prev => prev === 1.0 ? 0.75 : prev === 0.75 ? 1.25 : 1.0); };
  const toggleLoop = useCallback(() => setLoopAudio(prev => !prev), []);
  const speakNative = useCallback((text: string, onEnd?: () => void) => { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utteranceRef.current = utterance; if (selectedLang === 'fr') utterance.lang = 'fr-FR'; else if (selectedLang === 'en') utterance.lang = 'en-US'; else if (selectedLang === 'zh') utterance.lang = 'zh-CN'; else if (selectedLang === 'es') utterance.lang = 'es-ES'; utterance.rate = playbackSpeed; const voices = window.speechSynthesis.getVoices(); const langPrefix = selectedLang === 'zh' ? 'zh' : selectedLang; const preferredVoice = voices.find(voice => voice.lang.startsWith(langPrefix || 'en') && (voice.name.includes('Google') || voice.name.includes('Premium') || !voice.localService)); if (preferredVoice) utterance.voice = preferredVoice; let ended = false; const handleEnd = () => { if (ended) return; ended = true; utteranceRef.current = null; if (onEnd) onEnd(); }; utterance.onend = handleEnd; utterance.onerror = (e) => { handleEnd(); }; window.speechSynthesis.speak(utterance); if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current); audioTimeoutRef.current = setTimeout(() => { if (!ended) handleEnd(); }, (text.length * 200) + 2000); }, [selectedLang, playbackSpeed]);
  const speakFast = useCallback((text: string, onEnd?: () => void) => { if (!selectedLang) { if (onEnd) onEnd(); return; } window.speechSynthesis.cancel(); if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current); let tl = 'fr'; if (selectedLang === 'en') tl = 'en'; else if (selectedLang === 'zh') tl = 'zh-CN'; else if (selectedLang === 'es') tl = 'es'; const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${encodeURIComponent(text)}&tl=${tl}`; if (!currentAudioRef.current) currentAudioRef.current = new Audio(); const audio = currentAudioRef.current; let ended = false; const handleEnd = () => { if (ended) return; ended = true; if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current); if (onEnd) onEnd(); }; audio.onended = null; audio.onerror = null; audio.pause(); audio.currentTime = 0; audio.src = url; audio.playbackRate = playbackSpeed; audio.load(); audio.onended = handleEnd; audio.onerror = (e) => speakNative(text, onEnd); audioTimeoutRef.current = setTimeout(() => { if (!ended) handleEnd(); }, Math.max(2000, text.length * 150)); audio.play().catch(e => speakNative(text, onEnd)); }, [selectedLang, playbackSpeed, speakNative]);
  const speakAI = useCallback(async (text: string) => { const cacheKey = text.trim(); if (audioCache.current.has(cacheKey)) { const cachedUrl = audioCache.current.get(cacheKey); if (cachedUrl) { playAudioSource(cachedUrl, playbackSpeed); return; } } if (aiAudioLoading) return; window.speechSynthesis.cancel(); if (currentAudioRef.current) currentAudioRef.current.pause(); setAiAudioLoading(true); try { const base64Wav = await getHighQualityAudio(text, selectedLang || 'fr'); const url = `data:audio/wav;base64,${base64Wav}`; audioCache.current.set(cacheKey, url); await saveAudioSnippet(cacheKey, url); playAudioSource(url, playbackSpeed); } catch (err) { speakFast(text); } finally { setAiAudioLoading(false); } }, [aiAudioLoading, playbackSpeed, selectedLang, speakFast]); 
  const speakBestAvailable = useCallback((text: string, onEnd?: () => void) => { const cacheKey = text.trim(); if (audioCache.current.has(cacheKey)) { const cachedUrl = audioCache.current.get(cacheKey); if (cachedUrl) { playAudioSource(cachedUrl, playbackSpeed, onEnd); return; } } speakFast(text, onEnd); }, [playbackSpeed, speakFast]);
  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); if (passwordInput === '9912110') { setIsAuthenticated(true); localStorage.setItem('duo_ai_auth_v1', 'true'); setAuthError(false); } else { setAuthError(true); setPasswordInput(''); } };
  const handleLockApp = () => { setIsAuthenticated(false); localStorage.removeItem('duo_ai_auth_v1'); setIsSettingsOpen(false); setPasswordInput(''); setAuthError(false); };

  // --- GITHUB SYNC HANDLERS WITH VISUAL FEEDBACK ---
  const handleGitHubLoad = async () => {
      if (!githubUrl) { setSyncStatus('error'); setSyncMessage("Missing GitHub URL"); return; }
      
      setSyncStatus('loading');
      setSyncMessage('Downloading...');
      
      try {
          const jsonString = await loadFromGitHub(githubUrl);
          const result = await importFullSystemBackup(jsonString, selectedLang || undefined);
          
          if (result.success) {
              if (selectedLang) refreshData();
              if (result.audioCache) audioCache.current = result.audioCache;
              setSyncStatus('success');
              setSyncMessage("Loaded successfully!");
          } else {
              setSyncStatus('error');
              setSyncMessage(result.message || "Invalid Data");
          }
      } catch (e: any) {
          setSyncStatus('error');
          setSyncMessage(e.message);
      }
  };

  const handleGitHubSave = async () => {
      if (!githubUrl) { setSyncStatus('error'); setSyncMessage("Missing GitHub URL"); return; }
      if (!githubToken) { setSyncStatus('error'); setSyncMessage("Missing GitHub Token"); return; }
      
      if (!confirm("This will OVERWRITE the file on GitHub. Continue?")) return;

      setSyncStatus('loading');
      setSyncMessage('Uploading...');
      
      try {
          // Export without audio for GitHub (size limit)
          const data = await exportFullSystemBackup(false);
          await saveToGitHub(githubUrl, githubToken, data);
          setSyncStatus('success');
          setSyncMessage("Saved to GitHub!");
      } catch (e: any) {
          setSyncStatus('error');
          if (e.message.includes("401") || e.message.includes("Bad credentials")) {
             setSyncMessage("Error 401: Token Invalid or Expired.");
          } else if (e.message.includes("404")) {
             setSyncMessage("Error 404: Repo/Path not found.");
          } else {
             setSyncMessage("Save Failed: " + e.message);
          }
      }
  };

  // ... (Rest of handlers unchanged) ...
  const handleForceRepair = () => { if (!selectedLang) return; if (confirm("Run repair tool?")) { refreshData(); alert("Repaired!"); } };
  const handleResetContent = () => { if (!selectedLang) return; if (confirm("DELETE ALL WORDS?")) { const defaults = resetToDefaults(selectedLang); setVocab(defaults); alert("Reset complete."); } }
  const handleExport = async () => { try { const data = await exportFullSystemBackup(true); const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `duolingo_ai_full_backup_${Date.now()}.json`; a.click(); } catch (e) { alert("Export failed: " + e); } }
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setLoading(true); setLoadingMessage('Restoring...'); const reader = new FileReader(); reader.onload = async (ev) => { try { const content = ev.target?.result as string; const result = await importFullSystemBackup(content, selectedLang || undefined); if (result.success) { if (selectedLang) refreshData(); if (result.audioCache) audioCache.current = result.audioCache; alert(result.message); setIsSettingsOpen(false); } else { alert(result.message); } } catch (err) { alert("Error restoring."); } finally { setLoading(false); setLoadingMessage(''); } }; reader.readAsText(file); }
  const handleStartNew = async (topic: GenerationTopic = 'general', count: number = 10, autoFetchAudio: boolean = false, autoFetchExampleAudio: boolean = false) => { if (!selectedLang) return; setLoading(true); setLoadingMessage(mode === AppMode.GENERATING ? 'AI is thinking...' : 'Generating Vocabulary...'); setError(null); setMode(AppMode.GENERATING); try { const existingWords = vocab.map(v => v.target); const generatedWords = await generateVocabularyBatch(existingWords, topic, selectedLang, count); const distinctNewWords = generatedWords.filter(nw => { const normalizedNew = nw.target.trim().toLowerCase(); return !vocab.some(existing => existing.target.trim().toLowerCase() === normalizedNew); }); if (distinctNewWords.length === 0) throw new Error("AI generated duplicates."); if (autoFetchAudio || autoFetchExampleAudio) { let completedOps = 0; const totalOps = (autoFetchAudio ? distinctNewWords.length : 0) + (autoFetchExampleAudio ? distinctNewWords.length : 0); setLoadingMessage(`Downloading Audio (0/${totalOps})...`); for (let i = 0; i < distinctNewWords.length; i++) { const word = distinctNewWords[i]; if (autoFetchAudio) { try { const cacheKey = word.target.trim(); if (!audioCache.current.has(cacheKey)) { completedOps++; setLoadingMessage(`Downloading Audio (${completedOps}/${totalOps})...`); const base64Wav = await getHighQualityAudio(word.target, selectedLang); const url = `data:audio/wav;base64,${base64Wav}`; audioCache.current.set(cacheKey, url); await saveAudioSnippet(cacheKey, url); await new Promise(r => setTimeout(r, 300)); } } catch (e) {} } if (autoFetchExampleAudio) { try { const exampleKey = word.example.target.trim(); if (!audioCache.current.has(exampleKey)) { completedOps++; setLoadingMessage(`Downloading Audio (${completedOps}/${totalOps})...`); const base64Wav = await getHighQualityAudio(word.example.target, selectedLang); const url = `data:audio/wav;base64,${base64Wav}`; audioCache.current.set(exampleKey, url); await saveAudioSnippet(exampleKey, url); await new Promise(r => setTimeout(r, 300)); } } catch (e) {} } } } const updatedVocab = appendVocabulary(distinctNewWords, selectedLang); setVocab(updatedVocab); setCurrentBatch(distinctNewWords); const t = TRANSLATIONS[selectedLang]; let title = t.newVocab; if (topic === 'common-verbs') title = t.commonVerbs; if (topic === 'irregular-verbs') title = t.irregularVerbs; setStudyListTitle(title); setMode(AppMode.STUDY_LIST); } catch (err: any) { console.error(err); setError(err.message || "Error generating words."); setMode(AppMode.DASHBOARD); } finally { setLoading(false); setLoadingMessage(''); } };
  const handleOpenNews = () => { setMode(AppMode.NEWS_READER); if (newsArticles.length === 0 && selectedLang) handleFetchMoreNews(); };
  const handleFetchMoreNews = async () => { if (!selectedLang) return; setLoading(true); setLoadingMessage('Fetching News...'); try { const newArticles = await generateCanadianNews(selectedLang); const updatedList = appendNewsData(newArticles, selectedLang); setNewsArticles(updatedList); } catch (e) { setError("Could not fetch news."); } finally { setLoading(false); setLoadingMessage(''); } }
  const handleDeleteNews = (id: string) => { if (!selectedLang) return; const updated = deleteNewsArticle(id, selectedLang); setNewsArticles(updated); }
  const handleAddWord = (newWord: VocabularyWord) => { if (!selectedLang) return; const updatedVocab = appendVocabulary([newWord], selectedLang); setVocab(updatedVocab); };
  const handleEditWord = (updatedWord: VocabularyWord) => { if (!selectedLang) return; const updatedVocab = editVocabularyWord(updatedWord.id, updatedWord, selectedLang); setVocab(updatedVocab); if (currentBatch.some(w => w.id === updatedWord.id)) setCurrentBatch(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w)); };
  const handleDeleteWord = (id: string) => { if (!selectedLang) return; const wordToRemove = vocab.find(w => w.id === id); if (wordToRemove) { const targetKey = wordToRemove.target.trim(); if (audioCache.current.has(targetKey)) { audioCache.current.delete(targetKey); deleteAudioSnippet(targetKey); } if (wordToRemove.example && wordToRemove.example.target) { const exampleKey = wordToRemove.example.target.trim(); if (audioCache.current.has(exampleKey)) { audioCache.current.delete(exampleKey); deleteAudioSnippet(exampleKey); } } } const updated = removeVocabularyWord(id, selectedLang); setVocab(updated); if (currentBatch.some(w => w.id === id)) setCurrentBatch(prev => prev.filter(w => w.id !== id)); };
  const handleStartReview = () => { if (vocab.length === 0 || !selectedLang) return; const shuffled = [...vocab].sort(() => 0.5 - Math.random()); const selected = shuffled.slice(0, 20); setCurrentBatch(selected); setStudyListTitle(TRANSLATIONS[selectedLang].review); setMode(AppMode.STUDY_LIST); };
  const handleStartFavorites = () => { if (!selectedLang) return; setInitialFilter('FAV'); setMode(AppMode.VOCAB_LIST); }
  const handleStartMastered = () => { if (!selectedLang) return; setInitialFilter('MASTERED'); setMode(AppMode.VOCAB_LIST); };
  const handleViewList = () => { setInitialFilter('ALL'); setMode(AppMode.VOCAB_LIST); }
  const handleToggleMastered = (id: string, status: boolean) => { if (!selectedLang) return; const updates: Partial<VocabularyWord> = { mastered: status }; if (status === true) updates.isFavorite = false; const updated = updateWordStatus(id, updates, selectedLang); setVocab(updated); if (currentBatch.some(w => w.id === id)) setCurrentBatch(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w)); };
  const handleToggleFavorite = (id: string, status: boolean) => { if (!selectedLang) return; const updates: Partial<VocabularyWord> = { isFavorite: status }; if (status === true) updates.mastered = false; const updated = updateWordStatus(id, updates, selectedLang); setVocab(updated); if (currentBatch.some(w => w.id === id)) setCurrentBatch(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w)); };

  if (!isAuthenticated) return <div className="h-[100dvh] bg-gray-100 flex flex-col items-center justify-center p-6 font-sans text-slate-700"><div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl p-8 border-2 border-slate-200 text-center"><div className="bg-sky-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-sky-200"><Lock className="w-10 h-10 text-sky-500" /></div><h1 className="text-3xl font-black text-slate-700 mb-2">Duolingo AI</h1><p className="text-slate-400 font-bold mb-8 text-sm uppercase">Security Lock</p><form onSubmit={handleLogin} className="space-y-4"><div className="relative"><KeyRound className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-300 w-5 h-5" /><input type="password" inputMode="numeric" pattern="[0-9]*" value={passwordInput} onChange={(e) => { setAuthError(false); setPasswordInput(e.target.value); }} placeholder="Passcode" className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-black text-center text-2xl tracking-widest transition-all ${authError ? 'border-rose-300 text-rose-500 bg-rose-50' : 'border-slate-200 text-slate-700 focus:border-sky-500'}`} autoFocus /></div>{authError && <p className="text-xs font-bold text-rose-500 animate-pulse">Incorrect Passcode</p>}<button type="submit" className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-white rounded-2xl font-extrabold uppercase tracking-wide border-b-4 border-sky-600 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-sky-200">Unlock</button></form></div></div>;

  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-100 flex flex-col font-sans text-slate-700">
      {loading && <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white"><Loader2 className="w-16 h-16 animate-spin mb-4 text-sky-400" /><p className="text-2xl font-black tracking-wide animate-pulse px-4 text-center">{loadingMessage || 'Processing...'}</p></div>}
      {error && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-xs mx-auto"><AlertTriangle className="w-6 h-6 shrink-0" /><p className="font-bold text-sm">{error}</p><button onClick={() => setError(null)} className="ml-auto"><X className="w-5 h-5" /></button></div>}

      {mode === AppMode.LANGUAGE_SELECT && (
          <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-white">
              <div className="text-center space-y-2"><div className="bg-sky-100 p-4 rounded-3xl inline-block mb-2"><Globe className="w-12 h-12 text-sky-500" /></div><h1 className="text-3xl font-black text-slate-800">Duolingo AI</h1><p className="text-slate-400 font-bold">Choose target language</p></div>
              <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
                  <button onClick={() => setSelectedLang('fr')} className="flex items-center gap-4 p-4 bg-white border-2 border-blue-200 hover:bg-blue-50 rounded-2xl active:scale-95 group"><span className="text-3xl">🇫🇷</span><div className="text-left"><div className="font-black text-slate-700">French</div><div className="text-xs font-bold text-slate-400">A1 Beginner</div></div></button>
                  <button onClick={() => setSelectedLang('en')} className="flex items-center gap-4 p-4 bg-white border-2 border-blue-200 hover:bg-blue-50 rounded-2xl active:scale-95 group"><span className="text-3xl">🇺🇸</span><div className="text-left"><div className="font-black text-slate-700">English</div><div className="text-xs font-bold text-slate-400">B1 Intermediate</div></div></button>
                  <button onClick={() => setSelectedLang('zh')} className="flex items-center gap-4 p-4 bg-white border-2 border-red-200 hover:bg-red-50 rounded-2xl active:scale-95 group"><span className="text-3xl">🇨🇳</span><div className="text-left"><div className="font-black text-slate-700">Chinese</div><div className="text-xs font-bold text-slate-400">A1 Beginner</div></div></button>
                  <button onClick={() => setSelectedLang('es')} className="flex items-center gap-4 p-4 bg-white border-2 border-yellow-200 hover:bg-yellow-50 rounded-2xl active:scale-95 group"><span className="text-3xl">🇪🇸</span><div className="text-left"><div className="font-black text-slate-700">Spanish</div><div className="text-xs font-bold text-slate-400">A1 Beginner</div></div></button>
              </div>
          </div>
      )}

      {mode === AppMode.DASHBOARD && selectedLang && <Dashboard totalLearned={vocab.length} masteredCount={vocab.filter(w => w.mastered).length} favoriteCount={vocab.filter(w => w.isFavorite).length} currentLang={selectedLang} onStartNew={handleStartNew} onStartReview={handleStartReview} onStartFavorites={handleStartFavorites} onStartMastered={handleStartMastered} onViewList={handleViewList} onOpenSettings={() => setIsSettingsOpen(true)} onOpenNews={handleOpenNews} onSwitchLang={() => setSelectedLang(null)} />}
      {mode === AppMode.STUDY_LIST && selectedLang && <StudyList words={currentBatch} title={studyListTitle} onComplete={() => setMode(AppMode.DASHBOARD)} onBackToHome={() => setMode(AppMode.DASHBOARD)} speakFast={speakFast} speakAI={speakAI} speakBestAvailable={speakBestAvailable} aiLoading={aiAudioLoading} currentLang={selectedLang} onToggleMastered={handleToggleMastered} onToggleFavorite={handleToggleFavorite} playbackSpeed={playbackSpeed} swipeAutoplay={swipeAutoplay} fontSize={fontSize} loopAudio={loopAudio} onToggleLoop={toggleLoop} autoPlayDelay={autoPlayDelay} onUpdateDelay={setAutoPlayDelay} autoPlayExample={autoPlayExample} onToggleAutoPlayExample={() => setAutoPlayExample(!autoPlayExample)} />}
      {mode === AppMode.VOCAB_LIST && selectedLang && <VocabularyList words={vocab} currentLang={selectedLang} onBack={() => setMode(AppMode.DASHBOARD)} speakFast={speakFast} speakAI={speakAI} speakBestAvailable={speakBestAvailable} aiLoading={aiAudioLoading} onDelete={handleDeleteWord} onToggleMastered={handleToggleMastered} onToggleFavorite={handleToggleFavorite} playbackSpeed={playbackSpeed} onToggleSpeed={toggleSpeed} onAddWord={handleAddWord} onEditWord={handleEditWord} initialFilter={initialFilter} swipeAutoplay={swipeAutoplay} fontSize={fontSize} loopAudio={loopAudio} onToggleLoop={toggleLoop} autoPlayDelay={autoPlayDelay} onUpdateDelay={setAutoPlayDelay} autoPlayExample={autoPlayExample} onToggleAutoPlayExample={() => setAutoPlayExample(!autoPlayExample)} />}
      {mode === AppMode.NEWS_READER && selectedLang && <NewsReader articles={newsArticles} onBack={() => setMode(AppMode.DASHBOARD)} speakFast={speakFast} speakAI={speakAI} speakBestAvailable={speakBestAvailable} loading={loading} aiLoading={aiAudioLoading} currentLang={selectedLang} onAddWord={handleAddWord} onLoadMore={handleFetchMoreNews} onDeleteArticle={handleDeleteNews} playbackSpeed={playbackSpeed} onToggleSpeed={toggleSpeed} fontSize={fontSize} />}

      {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-2 border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-700">Settings</h3><button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-500" /></button></div>
                  <div className="space-y-4">
                      
                      {/* GITHUB SYNC SETTINGS */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-2 mb-3">
                               <Github className="w-5 h-5 text-indigo-500" />
                               <p className="font-bold text-slate-600">GitHub Sync</p>
                           </div>
                           <div className="space-y-2">
                               <label className="text-[10px] font-bold text-slate-400 uppercase">Raw JSON URL</label>
                               <input 
                                    type="text" 
                                    placeholder="https://raw.githubusercontent.com/..." 
                                    value={githubUrl}
                                    onChange={(e) => setGithubUrl(e.target.value)}
                                    className="w-full p-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500"
                               />
                               <label className="text-[10px] font-bold text-slate-400 uppercase">Personal Access Token (Repo scope)</label>
                               <input 
                                    type="password" 
                                    placeholder="ghp_..." 
                                    value={githubToken}
                                    onChange={(e) => setGithubToken(e.target.value)}
                                    className="w-full p-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500"
                               />
                           </div>
                           
                           {/* VISUAL STATUS FEEDBACK AREA */}
                           {syncStatus !== 'idle' && (
                               <div className={`mt-3 p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-1
                                   ${syncStatus === 'loading' ? 'bg-blue-50 text-blue-500 border border-blue-100' : 
                                     syncStatus === 'success' ? 'bg-green-50 text-green-500 border border-green-100' : 
                                     'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                                   
                                   {syncStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                                   {syncStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                                   {syncStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                                   <span className="flex-1 break-words">{syncMessage}</span>
                               </div>
                           )}

                           <div className="grid grid-cols-2 gap-3 mt-3">
                               <button 
                                    onClick={handleGitHubLoad}
                                    className="flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-500 rounded-xl font-bold border border-blue-100 hover:bg-blue-100 active:scale-95 disabled:opacity-50"
                                    disabled={syncStatus === 'loading'}
                               >
                                   <Download className="w-4 h-4" /> Pull
                               </button>
                               <button 
                                    onClick={handleGitHubSave}
                                    className="flex items-center justify-center gap-1 py-2 bg-indigo-50 text-indigo-500 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 active:scale-95 disabled:opacity-50"
                                    disabled={syncStatus === 'loading'}
                               >
                                   <Save className="w-4 h-4" /> Push
                               </button>
                           </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><div className="flex items-center gap-2 mb-3"><Type className="w-5 h-5 text-indigo-500" /><p className="font-bold text-slate-600">Text Size</p></div><div className="flex gap-2"><button onClick={() => setFontSize('normal')} className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm ${fontSize === 'normal' ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 border'}`}>Aa</button><button onClick={() => setFontSize('large')} className={`flex-1 py-3 rounded-xl font-bold transition-all text-lg ${fontSize === 'large' ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 border'}`}>Aa</button><button onClick={() => setFontSize('huge')} className={`flex-1 py-3 rounded-xl font-bold transition-all text-xl ${fontSize === 'huge' ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 border'}`}>Aa</button></div></div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="font-bold text-slate-600 mb-2">Audio Speed: {playbackSpeed}x</p><div className="flex gap-2">{[0.75, 1.0, 1.25].map(speed => (<button key={speed} onClick={() => setPlaybackSpeed(speed)} className={`flex-1 py-2 rounded-xl font-bold transition-all ${playbackSpeed === speed ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 border'}`}>{speed}x</button>))}</div></div>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="font-bold text-slate-600 mb-2">Full Backup (Local)</p><div className="grid grid-cols-2 gap-3"><button onClick={handleExport} className="flex flex-col items-center justify-center p-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-sky-50 active:scale-95"><Download className="w-6 h-6 text-sky-500 mb-1" /><span className="text-xs font-bold text-slate-500">Download</span></button><button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-green-50 active:scale-95"><Upload className="w-6 h-6 text-green-500 mb-1" /><span className="text-xs font-bold text-slate-500">Restore</span></button><input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} /></div></div>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-4">
                            <p className="font-bold text-slate-600 mb-2">Troubleshooting</p>
                            <div className="space-y-2">
                                <button onClick={handleForceRepair} className="w-full py-3 bg-orange-100 text-orange-500 rounded-xl font-bold border border-orange-200 hover:bg-orange-200 transition-all flex items-center justify-center gap-2">
                                    <RefreshCcw className="w-4 h-4" /> Repair Hidden Words
                                </button>
                                <button onClick={handleResetContent} className="w-full py-3 bg-rose-100 text-rose-500 rounded-xl font-bold border border-rose-200 hover:bg-rose-200 transition-all">
                                    Reset Language Content
                                </button>
                            </div>
                      </div>
                      <button onClick={handleLockApp} className="w-full mt-2 py-3 bg-rose-50 text-rose-500 rounded-2xl font-extrabold border-2 border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center gap-2"><Lock className="w-5 h-5" /> Lock App</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}