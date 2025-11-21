import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, VocabularyWord, Language, NewsArticle } from './types';
import { generateVocabularyBatch, getHighQualityAudio, GenerationTopic, generateCanadianNews } from './services/geminiService';
import { loadVocabularyData, appendVocabulary, updateWordStatus, removeVocabularyWord, getRawDataForExport, importDataFromJson, loadNewsData, appendNewsData, deleteNewsArticle, editVocabularyWord, loadSettings, saveSettings, loadAudioCache, saveAudioCache } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { StudyList } from './components/StudyList';
import { Flashcard } from './components/Flashcard';
import { VocabularyList, FilterType } from './components/VocabularyList';
import { NewsReader } from './components/NewsReader';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, X, Download, Upload, AlertTriangle, Globe, BookOpen, ArrowRight, LogOut, Volume2, VolumeX, Type } from 'lucide-react';
import { TRANSLATIONS } from './constants/translations';

export type FontSize = 'normal' | 'large' | 'huge';

export default function App() {
  // State for Language
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);

  const [mode, setMode] = useState<AppMode>(AppMode.LANGUAGE_SELECT);
  const [vocab, setVocab] = useState<VocabularyWord[]>([]);
  const [currentBatch, setCurrentBatch] = useState<VocabularyWord[]>([]);
  const [studyListTitle, setStudyListTitle] = useState<string>('');
  
  // Initial filter for Vocab List
  const [initialFilter, setInitialFilter] = useState<FilterType>('ALL');
  
  // News State
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  
  // Settings - Initialize from Storage
  const initialSettings = loadSettings();
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSettings.playbackSpeed);
  const [swipeAutoplay, setSwipeAutoplay] = useState(initialSettings.swipeAutoplay);
  const [fontSize, setFontSize] = useState<FontSize>(initialSettings.fontSize); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // REFS FOR AUDIO ENGINE
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ROBUST CACHING: Use Map for better performance with long strings
  // Initialize from LocalStorage
  const audioCache = useRef<Map<string, string>>(loadAudioCache());
  
  const [loading, setLoading] = useState(false);
  const [aiAudioLoading, setAiAudioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist settings changes
  useEffect(() => {
      saveSettings({ fontSize, playbackSpeed, swipeAutoplay });
  }, [fontSize, playbackSpeed, swipeAutoplay]);

  // Load vocabulary when language changes
  const refreshData = useCallback(() => {
      if (!selectedLang) return;
      const savedVocab = loadVocabularyData(selectedLang);
      setVocab(savedVocab);
      // Load news from storage
      const savedNews = loadNewsData(selectedLang);
      setNewsArticles(savedNews);
      
      // Refresh Settings too (in case import changed them)
      const settings = loadSettings();
      setFontSize(settings.fontSize);
      setPlaybackSpeed(settings.playbackSpeed);
      setSwipeAutoplay(settings.swipeAutoplay);
      
      // Refresh Audio Cache from storage (in case import added new audio)
      audioCache.current = loadAudioCache();
  }, [selectedLang]);

  useEffect(() => {
    if (selectedLang) {
        refreshData();
        setMode(AppMode.DASHBOARD);
    } else {
        setMode(AppMode.LANGUAGE_SELECT);
    }
  }, [selectedLang, refreshData]);

  // Ensure voices are loaded (for some browsers)
  useEffect(() => {
    const loadVoices = () => {
        window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    // Initialize the persistent Audio object
    if (!currentAudioRef.current) {
        currentAudioRef.current = new Audio();
        // Pre-configure to avoid delay
        currentAudioRef.current.preload = 'auto';
    }
    
    return () => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = "";
        }
        if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
    }
  }, []);

  const playAudioSource = (url: string, speed: number) => {
      // Stop browser speech if running
      window.speechSynthesis.cancel();

      if (!currentAudioRef.current) {
          currentAudioRef.current = new Audio();
      }

      const audio = currentAudioRef.current;
      
      // FORCE PAUSE to stop previous
      audio.pause();
      // CRITICAL: For replay of same URL, some browsers need explicit reset
      audio.currentTime = 0;
      audio.src = url;
      audio.playbackRate = speed;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise.catch(e => {
              console.error("Audio play failed (interaction policy?):", e);
          });
      }
  };

  const toggleSpeed = () => {
    setPlaybackSpeed(prev => {
        if (prev === 1.0) return 0.75; 
        if (prev === 0.75) return 1.25;
        return 1.0;
    });
  };

  // --- SPEECH LOGIC ---

  // 1. Native Browser Speech (Fallback & Desktop)
  const speakNative = useCallback((text: string, onEnd?: () => void) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Keep ref to prevent garbage collection
        utteranceRef.current = utterance;
        
        if (selectedLang === 'fr') utterance.lang = 'fr-FR';
        else if (selectedLang === 'en') utterance.lang = 'en-US';
        else if (selectedLang === 'zh') utterance.lang = 'zh-CN';
        else if (selectedLang === 'es') utterance.lang = 'es-ES';
        
        utterance.rate = playbackSpeed; 
        
        // Attempt to find a better native voice
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = selectedLang === 'zh' ? 'zh' : selectedLang;
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith(langPrefix) && 
            (voice.name.includes('Google') || voice.name.includes('Premium') || voice.name.includes('Enhanced') || !voice.localService)
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Safely handle onEnd
        let ended = false;
        const handleEnd = () => {
            if (ended) return;
            ended = true;
            utteranceRef.current = null; // Release ref
            if (onEnd) onEnd();
        };

        utterance.onend = handleEnd;
        utterance.onerror = (e) => {
            console.error("Native TTS Error", e);
            handleEnd(); 
        };

        window.speechSynthesis.speak(utterance);
        
        // Backup timeout
        if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
        audioTimeoutRef.current = setTimeout(() => {
            if (!ended) handleEnd();
        }, (text.length * 200) + 2000); 

  }, [selectedLang, playbackSpeed]);

  // 2. Smart Speak Fast (Google TTS for iOS + Fallback)
  const speakFast = useCallback((text: string, onEnd?: () => void) => {
    if (!selectedLang) {
        if (onEnd) onEnd();
        return;
    }
    
    // Cancel any ongoing native speech
    window.speechSynthesis.cancel();
    if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);

    let tl = 'fr';
    if (selectedLang === 'en') tl = 'en';
    else if (selectedLang === 'zh') tl = 'zh-CN';
    else if (selectedLang === 'es') tl = 'es';

    // Use googleapis.com
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${encodeURIComponent(text)}&tl=${tl}`;
    
    if (!currentAudioRef.current) {
        currentAudioRef.current = new Audio();
    }
    const audio = currentAudioRef.current;

    // Cleanup previous listeners before adding new ones
    let ended = false;
    const handleEnd = () => {
        if (ended) return;
        ended = true;
        if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
        if (onEnd) onEnd();
    };

    audio.pause();
    audio.currentTime = 0;
    audio.src = url;
    audio.playbackRate = playbackSpeed;
    audio.load();

    audio.onended = handleEnd;
    
    audio.onerror = (e) => {
        console.warn("Google TTS failed/blocked, falling back to native.", e);
        speakNative(text, onEnd);
    };

    // Safety Timeout
    const estimatedDuration = Math.max(2000, text.length * 150);
    audioTimeoutRef.current = setTimeout(() => {
        if (!ended) {
            console.log("Audio timeout forced");
            handleEnd();
        }
    }, estimatedDuration);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.warn("Audio play promise rejected (likely interaction policy or network)", e);
            speakNative(text, onEnd);
        });
    }

  }, [selectedLang, playbackSpeed, speakNative]);

  // 3. AI Speech (Persistent Cache)
  const speakAI = useCallback(async (text: string) => {
    // 1. Check Cache (RAM & LocalStorage)
    // Normalize text to avoid duplicate requests for "Hello" vs "Hello "
    const cacheKey = text.trim();
    
    if (audioCache.current.has(cacheKey)) {
        const cachedUrl = audioCache.current.get(cacheKey);
        if (cachedUrl) {
            console.log("Playing from Persistent Cache", cacheKey);
            playAudioSource(cachedUrl, playbackSpeed);
            return;
        }
    }
    
    // 2. If not cached, fetch from API
    if (aiAudioLoading) return; 
    
    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
    }

    setAiAudioLoading(true);
    try {
        const base64Wav = await getHighQualityAudio(text);
        const url = `data:audio/wav;base64,${base64Wav}`;
        
        // 3. Save to RAM Cache
        audioCache.current.set(cacheKey, url);
        
        // 4. Save to Persistent Cache (LocalStorage)
        saveAudioCache(audioCache.current);
        
        // 5. Play
        playAudioSource(url, playbackSpeed);
    } catch (err) {
        console.error("AI Audio playback error", err);
        setError("AI Voice unavailable right now. Try Fast mode.");
    } finally {
        setAiAudioLoading(false);
    }
  }, [aiAudioLoading, playbackSpeed]); 

  // Main Logic Functions
  const handleStartNew = async (topic: GenerationTopic = 'general') => {
    if (!selectedLang) return;
    setLoading(true);
    setError(null);
    setMode(AppMode.GENERATING);
    try {
      const existingWords = vocab.map(v => v.target);
      const generatedWords = await generateVocabularyBatch(existingWords, topic, selectedLang);
      
      const distinctNewWords = generatedWords.filter(nw => {
          const normalizedNew = nw.target.trim().toLowerCase();
          return !vocab.some(existing => existing.target.trim().toLowerCase() === normalizedNew);
      });

      if (distinctNewWords.length === 0) {
          throw new Error("AI generated words that you already know. I filtered them out. Please try again!");
      }

      const updatedVocab = appendVocabulary(distinctNewWords, selectedLang);
      setVocab(updatedVocab);
      setCurrentBatch(distinctNewWords);
      
      // Dynamic Title
      const t = TRANSLATIONS[selectedLang];
      let title = t.newVocab;
      if (topic === 'common-verbs') title = t.commonVerbs;
      if (topic === 'irregular-verbs') title = t.irregularVerbs;
      setStudyListTitle(title);
      
      setMode(AppMode.STUDY_LIST);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error generating words. Please try again.");
      setMode(AppMode.DASHBOARD);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenNews = () => {
      setMode(AppMode.NEWS_READER);
      if (newsArticles.length === 0 && selectedLang) {
           handleFetchMoreNews();
      }
  };

  const handleFetchMoreNews = async () => {
      if (!selectedLang) return;
      setLoading(true);
      try {
          const newArticles = await generateCanadianNews(selectedLang);
          const updatedList = appendNewsData(newArticles, selectedLang);
          setNewsArticles(updatedList);
      } catch (e) {
          setError("Could not fetch news.");
      } finally {
          setLoading(false);
      }
  }

  const handleDeleteNews = (id: string) => {
      if (!selectedLang) return;
      const updated = deleteNewsArticle(id, selectedLang);
      setNewsArticles(updated);
  }

  const handleAddWord = (newWord: VocabularyWord) => {
      if (!selectedLang) return;
      const updatedVocab = appendVocabulary([newWord], selectedLang);
      setVocab(updatedVocab);
  };

  const handleEditWord = (updatedWord: VocabularyWord) => {
      if (!selectedLang) return;
      const updatedVocab = editVocabularyWord(updatedWord.id, updatedWord, selectedLang);
      setVocab(updatedVocab);
      
      if (currentBatch.some(w => w.id === updatedWord.id)) {
          setCurrentBatch(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
      }
  };

  const handleDeleteWord = (id: string) => {
      if (!selectedLang) return;
      const updated = removeVocabularyWord(id, selectedLang);
      setVocab(updated);
      if (currentBatch.some(w => w.id === id)) {
          setCurrentBatch(prev => prev.filter(w => w.id !== id));
      }
  };

  const handleStartReview = () => {
    if (vocab.length === 0 || !selectedLang) return;
    const shuffled = [...vocab].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 20);
    setCurrentBatch(selected);
    setStudyListTitle(TRANSLATIONS[selectedLang].review);
    setMode(AppMode.STUDY_LIST); 
  };

  const handleStartFavorites = () => {
      if (!selectedLang) return;
      setInitialFilter('FAV');
      setMode(AppMode.VOCAB_LIST);
  }

  const handleStartMastered = () => {
    if (!selectedLang) return;
    setInitialFilter('MASTERED');
    setMode(AppMode.VOCAB_LIST);
  };
  
  const handleViewList = () => {
      setInitialFilter('ALL');
      setMode(AppMode.VOCAB_LIST);
  }

  const handleToggleMastered = (id: string, status: boolean) => {
      if (!selectedLang) return;
      const updated = updateWordStatus(id, { mastered: status }, selectedLang);
      setVocab(updated);
      if (currentBatch.some(w => w.id === id)) {
           setCurrentBatch(prev => prev.map(w => w.id === id ? { ...w, mastered: status } : w));
      }
  };

  const handleToggleFavorite = (id: string, status: boolean) => {
      if (!selectedLang) return;
      const updated = updateWordStatus(id, { isFavorite: status }, selectedLang);
      setVocab(updated);
      if (currentBatch.some(w => w.id === id)) {
           setCurrentBatch(prev => prev.map(w => w.id === id ? { ...w, isFavorite: status } : w));
      }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-100 flex flex-col font-sans text-slate-700">
      
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <Loader2 className="w-16 h-16 animate-spin mb-4 text-sky-400" />
            <p className="text-2xl font-black tracking-wide animate-pulse">
                {mode === AppMode.GENERATING ? 'AI is thinking...' : 'Loading...'}
            </p>
            {mode === AppMode.GENERATING && (
                <p className="text-sm text-white/70 mt-2 max-w-xs text-center">Creating unique vocabulary for you...</p>
            )}
        </div>
      )}
      
      {error && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-xs mx-auto animate-in slide-in-from-top-5">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="font-bold text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-5 h-5" /></button>
          </div>
      )}

      {mode === AppMode.LANGUAGE_SELECT && (
          <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-white">
              <div className="text-center space-y-2">
                   <div className="bg-sky-100 p-4 rounded-3xl inline-block mb-2">
                        <Globe className="w-12 h-12 text-sky-500" />
                   </div>
                   <h1 className="text-3xl font-black text-slate-800">Duolingo AI</h1>
                   <p className="text-slate-400 font-bold">Choose your target language</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
                  <button onClick={() => setSelectedLang('fr')} className="flex items-center gap-4 p-4 bg-white border-2 border-blue-200 hover:bg-blue-50 rounded-2xl transition-all active:scale-95 shadow-sm group">
                      <span className="text-3xl">🇫🇷</span>
                      <div className="text-left">
                          <div className="font-black text-slate-700 group-hover:text-blue-600">French</div>
                          <div className="text-xs font-bold text-slate-400">A1 Beginner</div>
                      </div>
                  </button>
                  <button onClick={() => setSelectedLang('en')} className="flex items-center gap-4 p-4 bg-white border-2 border-blue-200 hover:bg-blue-50 rounded-2xl transition-all active:scale-95 shadow-sm group">
                      <span className="text-3xl">🇺🇸</span>
                      <div className="text-left">
                          <div className="font-black text-slate-700 group-hover:text-blue-600">English</div>
                          <div className="text-xs font-bold text-slate-400">B1 Intermediate</div>
                      </div>
                  </button>
                  <button onClick={() => setSelectedLang('zh')} className="flex items-center gap-4 p-4 bg-white border-2 border-red-200 hover:bg-red-50 rounded-2xl transition-all active:scale-95 shadow-sm group">
                      <span className="text-3xl">🇨🇳</span>
                      <div className="text-left">
                          <div className="font-black text-slate-700 group-hover:text-red-600">Chinese</div>
                          <div className="text-xs font-bold text-slate-400">A1 Beginner</div>
                      </div>
                  </button>
                  <button onClick={() => setSelectedLang('es')} className="flex items-center gap-4 p-4 bg-white border-2 border-yellow-200 hover:bg-yellow-50 rounded-2xl transition-all active:scale-95 shadow-sm group">
                      <span className="text-3xl">🇪🇸</span>
                      <div className="text-left">
                          <div className="font-black text-slate-700 group-hover:text-yellow-600">Spanish</div>
                          <div className="text-xs font-bold text-slate-400">A1 Beginner</div>
                      </div>
                  </button>
              </div>
          </div>
      )}

      {mode === AppMode.DASHBOARD && selectedLang && (
        <Dashboard 
          totalLearned={vocab.length}
          masteredCount={vocab.filter(w => w.mastered).length}
          favoriteCount={vocab.filter(w => w.isFavorite).length}
          currentLang={selectedLang}
          onStartNew={handleStartNew}
          onStartReview={handleStartReview}
          onStartFavorites={handleStartFavorites}
          onStartMastered={handleStartMastered}
          onViewList={handleViewList}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenNews={handleOpenNews}
          onSwitchLang={() => setSelectedLang(null)}
        />
      )}

      {mode === AppMode.STUDY_LIST && selectedLang && (
        <StudyList 
          words={currentBatch}
          title={studyListTitle}
          onComplete={() => setMode(AppMode.DASHBOARD)}
          onBackToHome={() => setMode(AppMode.DASHBOARD)}
          speakFast={speakFast}
          speakAI={speakAI}
          aiLoading={aiAudioLoading}
          currentLang={selectedLang}
          onToggleMastered={handleToggleMastered}
          onToggleFavorite={handleToggleFavorite}
          playbackSpeed={playbackSpeed}
          swipeAutoplay={swipeAutoplay}
          fontSize={fontSize}
        />
      )}

      {mode === AppMode.VOCAB_LIST && selectedLang && (
          <VocabularyList 
            words={vocab}
            currentLang={selectedLang}
            onBack={() => setMode(AppMode.DASHBOARD)}
            speakFast={speakFast}
            speakAI={speakAI}
            aiLoading={aiAudioLoading}
            onDelete={handleDeleteWord}
            onToggleMastered={handleToggleMastered}
            onToggleFavorite={handleToggleFavorite}
            playbackSpeed={playbackSpeed}
            onToggleSpeed={toggleSpeed}
            onAddWord={handleAddWord}
            onEditWord={handleEditWord}
            initialFilter={initialFilter}
            swipeAutoplay={swipeAutoplay}
            fontSize={fontSize}
          />
      )}

      {mode === AppMode.NEWS_READER && selectedLang && (
          <NewsReader 
              articles={newsArticles}
              onBack={() => setMode(AppMode.DASHBOARD)}
              speakFast={speakFast}
              speakAI={speakAI}
              loading={loading}
              aiLoading={aiAudioLoading}
              currentLang={selectedLang}
              onAddWord={handleAddWord}
              onLoadMore={handleFetchMoreNews}
              onDeleteArticle={handleDeleteNews}
              playbackSpeed={playbackSpeed}
              onToggleSpeed={toggleSpeed}
              fontSize={fontSize}
          />
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-2 border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black text-slate-700">Settings</h3>
                      <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-500" /></button>
                  </div>

                  <div className="space-y-4">
                      {/* Font Size Setting */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-2 mb-3">
                               <Type className="w-5 h-5 text-indigo-500" />
                               <p className="font-bold text-slate-600">Text Size</p>
                           </div>
                           <div className="flex gap-2">
                               <button 
                                    onClick={() => setFontSize('normal')}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm ${fontSize === 'normal' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                               >
                                   Aa
                               </button>
                               <button 
                                    onClick={() => setFontSize('large')}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-lg ${fontSize === 'large' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                               >
                                   Aa
                               </button>
                               <button 
                                    onClick={() => setFontSize('huge')}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-xl ${fontSize === 'huge' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                               >
                                   Aa
                               </button>
                           </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="font-bold text-slate-600 mb-2">Audio Speed: {playbackSpeed}x</p>
                           <div className="flex gap-2">
                               {[0.75, 1.0, 1.25].map(speed => (
                                   <button 
                                    key={speed}
                                    onClick={() => setPlaybackSpeed(speed)}
                                    className={`flex-1 py-2 rounded-xl font-bold transition-all ${playbackSpeed === speed ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                                   >
                                       {speed}x
                                   </button>
                               ))}
                           </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              {swipeAutoplay ? <Volume2 className="w-6 h-6 text-sky-500" /> : <VolumeX className="w-6 h-6 text-slate-400" />}
                              <div>
                                  <p className="font-bold text-slate-700 text-sm">Swipe Audio</p>
                                  <p className="text-xs text-slate-400 font-bold">Auto-play when swiping</p>
                              </div>
                          </div>
                          <button 
                            onClick={() => setSwipeAutoplay(!swipeAutoplay)}
                            className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${swipeAutoplay ? 'bg-sky-500' : 'bg-slate-300'}`}
                          >
                              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform duration-300 shadow-sm ${swipeAutoplay ? 'left-6' : 'left-1'}`}></div>
                          </button>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="font-bold text-slate-600 mb-2">Full Backup (Includes Audio)</p>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => {
                                    if (!selectedLang) return;
                                    const data = getRawDataForExport(selectedLang);
                                    const blob = new Blob([data], { type: "application/json" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `full_backup_${selectedLang}_${Date.now()}.json`;
                                    a.click();
                                }}
                                className="flex flex-col items-center justify-center p-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-sky-50 hover:border-sky-200 transition-all active:scale-95"
                              >
                                  <Download className="w-6 h-6 text-sky-500 mb-1" />
                                  <span className="text-xs font-bold text-slate-500">Download</span>
                              </button>

                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-green-50 hover:border-green-200 transition-all active:scale-95"
                              >
                                  <Upload className="w-6 h-6 text-green-500 mb-1" />
                                  <span className="text-xs font-bold text-slate-500">Restore</span>
                              </button>
                              <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden"
                                accept=".json"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !selectedLang) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                        const content = ev.target?.result as string;
                                        const success = importDataFromJson(content, selectedLang);
                                        if (success) {
                                            refreshData();
                                            alert("Restored successfully! Audio & Settings updated.");
                                            setIsSettingsOpen(false);
                                        } else {
                                            alert("Invalid file format.");
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                              />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 text-center leading-tight">
                              Saves all your vocab, news, settings, and *downloaded AI voices* so you can play offline.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}