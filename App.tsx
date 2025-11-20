import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, VocabularyWord, Language, NewsArticle } from './types';
import { generateVocabularyBatch, getHighQualityAudio, GenerationTopic, generateCanadianNews } from './services/geminiService';
import { loadVocabularyData, appendVocabulary, updateWordStatus, removeVocabularyWord, getRawDataForExport, importDataFromJson, loadNewsData, appendNewsData, deleteNewsArticle } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { StudyList } from './components/StudyList';
import { Flashcard } from './components/Flashcard';
import { VocabularyList } from './components/VocabularyList';
import { NewsReader } from './components/NewsReader';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, X, Download, Upload, AlertTriangle, Globe, BookOpen, ArrowRight, LogOut } from 'lucide-react';
import { TRANSLATIONS } from './constants/translations';

export default function App() {
  // State for Language
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);

  const [mode, setMode] = useState<AppMode>(AppMode.LANGUAGE_SELECT);
  const [vocab, setVocab] = useState<VocabularyWord[]>([]);
  const [currentBatch, setCurrentBatch] = useState<VocabularyWord[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [studyListTitle, setStudyListTitle] = useState<string>('');
  
  // News State
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [aiAudioLoading, setAiAudioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load vocabulary when language changes
  const refreshData = useCallback(() => {
      if (!selectedLang) return;
      const savedVocab = loadVocabularyData(selectedLang);
      setVocab(savedVocab);
      // Load news from storage
      const savedNews = loadNewsData(selectedLang);
      setNewsArticles(savedNews);
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
  }, []);

  // Audio Logic
  const playAudioSource = (url: string, speed: number) => {
      // Stop browser speech if running
      window.speechSynthesis.cancel();

      if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
      }
      const audio = new Audio(url);
      audio.playbackRate = speed;
      audio.play().catch(e => console.error("Audio play failed:", e));
      currentAudioRef.current = audio;
  };

  const toggleSpeed = () => {
    setPlaybackSpeed(prev => {
        if (prev === 1.0) return 0.75; 
        if (prev === 0.75) return 1.25;
        return 1.0;
    });
  };

  // UPDATED: Intelligent Speak Fast - Uses Google Translate TTS for iOS/Mobile
  const speakFast = useCallback((text: string) => {
    try {
        if (!selectedLang) return;
        
        // Stop any playing audio
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
        }
        window.speechSynthesis.cancel();

        // Detect iOS/Mobile (Rough check)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // If iOS, use Google Translate Hack for better quality than native
        if (isIOS) {
            let tl = 'fr';
            if (selectedLang === 'en') tl = 'en';
            else if (selectedLang === 'zh') tl = 'zh-CN';
            else if (selectedLang === 'es') tl = 'es';
            
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(text)}&tl=${tl}&total=1&idx=0&textlen=${text.length}`;
            playAudioSource(url, playbackSpeed);
            return;
        }

        // FOR DESKTOP (Chrome/Edge have good native voices)
        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedLang === 'fr') utterance.lang = 'fr-FR';
        else if (selectedLang === 'en') utterance.lang = 'en-US';
        else if (selectedLang === 'zh') utterance.lang = 'zh-CN';
        else if (selectedLang === 'es') utterance.lang = 'es-ES';
        
        utterance.rate = playbackSpeed; 
        
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = selectedLang === 'zh' ? 'zh' : selectedLang;
        // Try to get a Google voice or Premium voice if available
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith(langPrefix) && 
            (voice.name.includes('Google') || voice.name.includes('Premium') || !voice.localService)
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);

    } catch (err) {
        console.error("TTS error", err);
    }
  }, [playbackSpeed, selectedLang]);

  const speakAI = useCallback(async (text: string) => {
    if (aiAudioLoading) return; 
    
    // Stop other audio sources
    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
    }

    setAiAudioLoading(true);
    try {
        const base64Wav = await getHighQualityAudio(text);
        const url = `data:audio/wav;base64,${base64Wav}`;
        playAudioSource(url, playbackSpeed);
    } catch (err) {
        console.error("AI Audio playback error", err);
        alert("Error loading AI voice. Please try again.");
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
      const newWords = await generateVocabularyBatch(existingWords, topic, selectedLang);
      const updatedVocab = appendVocabulary(newWords, selectedLang);
      setVocab(updatedVocab);
      setCurrentBatch(newWords);
      
      // Dynamic Title
      const t = TRANSLATIONS[selectedLang];
      let title = t.newVocab;
      if (topic === 'common-verbs') title = t.commonVerbs;
      if (topic === 'irregular-verbs') title = t.irregularVerbs;
      setStudyListTitle(title);
      
      setMode(AppMode.STUDY_LIST);
    } catch (err) {
      console.error(err);
      setError("Error generating words. Please try again.");
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

  const handleStartReview = () => {
    if (vocab.length === 0 || !selectedLang) return;
    const shuffled = [...vocab].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 20);
    setCurrentBatch(selected);
    setStudyListTitle(TRANSLATIONS[selectedLang].review);
    setMode(AppMode.STUDY_LIST); // GO TO LIST FIRST FOR AUTOPLAY
  };

  const handleStartFavorites = () => {
      if (!selectedLang) return;
      const favorites = vocab.filter(v => v.isFavorite);
      if (favorites.length === 0) return;
      const shuffled = [...favorites].sort(() => 0.5 - Math.random());
      setCurrentBatch(shuffled);
      setStudyListTitle(TRANSLATIONS[selectedLang].favorites);
      setMode(AppMode.STUDY_LIST); // GO TO LIST FIRST FOR AUTOPLAY
  }

  const handleStartMastered = () => {
    if (!selectedLang) return;
    const mastered = vocab.filter(v => v.mastered);
    if (mastered.length === 0) return;
    const shuffled = [...mastered].sort(() => 0.5 - Math.random());
    setCurrentBatch(shuffled);
    setStudyListTitle(TRANSLATIONS[selectedLang].mastered);
    setMode(AppMode.STUDY_LIST); // GO TO LIST FIRST FOR AUTOPLAY
  }

  const handleToggleMastered = (id: string, currentStatus: boolean) => {
    if (!selectedLang) return;
    const newStatus = !currentStatus;
    // Update current batch
    const updatedBatch = currentBatch.map(w => 
        w.id === id ? { ...w, mastered: newStatus } : w
    );
    setCurrentBatch(updatedBatch);
    // Update global vocab & storage
    const newVocab = updateWordStatus(id, { mastered: newStatus }, selectedLang);
    setVocab(newVocab);
  };
  
  const handleToggleFavorite = (id: string, currentStatus: boolean) => {
      if (!selectedLang) return;
      const newStatus = !currentStatus;
      const updatedBatch = currentBatch.map(w => 
          w.id === id ? { ...w, isFavorite: newStatus } : w
      );
      setCurrentBatch(updatedBatch);
      const newVocab = updateWordStatus(id, { isFavorite: newStatus }, selectedLang);
      setVocab(newVocab);
  }
  
  const handleDeleteWord = (id: string) => {
      if (!selectedLang) return;
      const updatedVocab = removeVocabularyWord(id, selectedLang);
      setVocab(updatedVocab);
      setCurrentBatch(prev => prev.filter(w => w.id !== id));
  };

  const handleViewList = () => {
    setMode(AppMode.VOCAB_LIST);
  };

  const startFlashcards = () => {
    setFlashcardIndex(0);
    setMode(AppMode.FLASHCARD);
  };

  const nextCard = () => {
    if (flashcardIndex < currentBatch.length - 1) {
      setFlashcardIndex(prev => prev + 1);
    } else {
      finishSession();
    }
  };

  const prevCard = () => {
    if (flashcardIndex > 0) {
      setFlashcardIndex(prev => prev - 1);
    }
  };

  const finishSession = () => {
    setMode(AppMode.COMPLETE);
  };

  // Export/Import
  const handleExport = () => {
      if (!selectedLang) return;
      const dataStr = getRawDataForExport(selectedLang);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${selectedLang}_vocab_data_${new Date().toISOString().slice(0, 10)}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportClick = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedLang) return;
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
              const success = importDataFromJson(text, selectedLang);
              if (success) {
                  alert("Data imported successfully!");
                  refreshData();
                  setIsSettingsOpen(false);
              } else {
                  alert("Invalid file.");
              }
          }
      };
      reader.readAsText(file);
      event.target.value = ''; 
  };
  
  const generalVocabCount = vocab.filter(v => v.category === 'general' || !v.category).length;
  const masteredCount = vocab.filter(v => v.mastered).length;
  const favoriteCount = vocab.filter(v => v.isFavorite).length;

  const t = selectedLang ? TRANSLATIONS[selectedLang] : null;

  return (
    <div className="h-[100dvh] bg-gray-100 text-slate-700 flex flex-col overflow-hidden font-sans">
      {/* Global Loading */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center px-4">
          <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
          <p className="text-white font-bold text-lg animate-pulse">AI Processing...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-rose-100 border-2 border-rose-500 text-rose-600 px-6 py-4 rounded-2xl z-50 shadow-xl font-bold">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-sm underline mt-2 hover:text-rose-800 block text-center w-full">Close</button>
        </div>
      )}

      {/* LANGUAGE SELECTION SCREEN */}
      {mode === AppMode.LANGUAGE_SELECT && (
        <div className="flex flex-col h-full bg-gray-100 p-6 items-center justify-center animate-in fade-in duration-500 overflow-y-auto">
            <div className="mb-6 text-center shrink-0">
                <div className="bg-green-500 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3 border-b-[6px] border-green-600">
                    <Globe className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-3xl font-black text-slate-700 mb-1">Dualingo AI</h1>
                <p className="text-slate-500 font-bold text-base">Master a new language with AI</p>
            </div>

            <div className="w-full max-w-md space-y-3 pb-6">
                 {/* 1. FRENCH */}
                 <button 
                    onClick={() => setSelectedLang('fr')}
                    className="w-full group relative bg-white border-2 border-slate-200 border-b-4 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] transition-all"
                >
                    <div className="w-16 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-slate-200">
                        <div className="w-1/3 h-full bg-blue-600"></div>
                        <div className="w-1/3 h-full bg-white"></div>
                        <div className="w-1/3 h-full bg-red-600"></div>
                    </div>
                    <div className="text-left flex-1">
                        <h2 className="text-xl font-extrabold text-slate-700">Français</h2>
                        <p className="text-slate-400 font-bold text-xs">Level A1 (Débutant)</p>
                    </div>
                     <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                </button>

                {/* 2. ENGLISH */}
                <button 
                    onClick={() => setSelectedLang('en')}
                    className="w-full group relative bg-white border-2 border-slate-200 border-b-4 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] transition-all"
                >
                    <div className="w-16 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm overflow-hidden relative border border-slate-200">
                         <div className="absolute inset-0 flex">
                            <div className="w-full h-full bg-blue-700 flex items-center justify-center text-white font-bold text-xs">US/UK</div>
                        </div>
                    </div>
                    <div className="text-left flex-1">
                        <h2 className="text-xl font-extrabold text-slate-700">English</h2>
                        <p className="text-slate-400 font-bold text-xs">Level B1 (Intermediate)</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                </button>

                {/* 3. CHINESE */}
                <button 
                    onClick={() => setSelectedLang('zh')}
                    className="w-full group relative bg-white border-2 border-slate-200 border-b-4 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] transition-all"
                >
                    <div className="w-16 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-sm overflow-hidden relative border border-slate-200">
                        <div className="text-yellow-400 font-black text-2xl">五</div>
                    </div>
                    <div className="text-left flex-1">
                        <h2 className="text-xl font-extrabold text-slate-700">中文 (Chinese)</h2>
                        <p className="text-slate-400 font-bold text-xs">Level A1 (Beginner)</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                </button>

                {/* 4. SPANISH */}
                <button 
                    onClick={() => setSelectedLang('es')}
                    className="w-full group relative bg-white border-2 border-slate-200 border-b-4 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] transition-all"
                >
                    <div className="w-16 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-sm overflow-hidden relative border border-slate-200">
                        <div className="w-full h-1/3 bg-yellow-400 absolute top-1/3 flex items-center justify-center"></div>
                    </div>
                    <div className="text-left flex-1">
                        <h2 className="text-xl font-extrabold text-slate-700">Español</h2>
                        <p className="text-slate-400 font-bold text-xs">Level A1 (Beginner)</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                </button>
            </div>

            <p className="mt-4 text-slate-400 font-bold text-xs">Hana Minh Tran • Dualingo AI</p>
        </div>
      )}

      {/* DASHBOARD */}
      {mode === AppMode.DASHBOARD && selectedLang && (
        <Dashboard 
            totalLearned={generalVocabCount} 
            masteredCount={masteredCount}
            favoriteCount={favoriteCount}
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
      
      {/* NEWS READER */}
      {mode === AppMode.NEWS_READER && selectedLang && (
          <NewsReader 
            articles={newsArticles}
            onBack={() => setMode(AppMode.DASHBOARD)}
            loading={loading}
            aiLoading={aiAudioLoading}
            speakFast={speakFast}
            speakAI={speakAI}
            currentLang={selectedLang}
            onAddWord={handleAddWord}
            onLoadMore={handleFetchMoreNews}
            onDeleteArticle={handleDeleteNews}
            playbackSpeed={playbackSpeed}
            onToggleSpeed={toggleSpeed}
          />
      )}

      {/* VOCAB LIST */}
      {mode === AppMode.VOCAB_LIST && selectedLang && (
          <div className="flex-1 overflow-hidden flex flex-col h-full">
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
            />
          </div>
      )}

      {/* STUDY LIST */}
      {mode === AppMode.STUDY_LIST && selectedLang && (
        <div className="flex flex-col h-full overflow-hidden bg-gray-100">
            <StudyList 
                words={currentBatch} 
                title={studyListTitle}
                onComplete={startFlashcards} 
                onBackToHome={() => setMode(AppMode.DASHBOARD)}
                speakFast={speakFast}
                speakAI={speakAI}
                aiLoading={aiAudioLoading}
                currentLang={selectedLang}
                onToggleMastered={handleToggleMastered}
                onToggleFavorite={handleToggleFavorite}
                playbackSpeed={playbackSpeed}
            />
        </div>
      )}

      {/* FLASHCARDS */}
      {mode === AppMode.FLASHCARD && t && (
        <div className="flex flex-col h-full max-w-lg mx-auto w-full overflow-hidden bg-gray-100">
            <div className="p-4 flex justify-between items-center shrink-0">
                 <button onClick={() => setMode(AppMode.DASHBOARD)} className="text-slate-400 hover:text-slate-600 p-2">
                    <X className="w-6 h-6" />
                </button>
                
                <div className="flex-1 mx-4">
                    <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-green-500 transition-all duration-500 ease-out rounded-full"
                            style={{ width: `${((flashcardIndex + 1) / currentBatch.length) * 100}%` }}
                        />
                    </div>
                </div>
                
                <button 
                    onClick={toggleSpeed}
                    className="w-8 h-8 flex items-center justify-center bg-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-300"
                >
                    {playbackSpeed}x
                </button>
            </div>
            
            <div className="flex-1 flex flex-col justify-center px-4 overflow-y-auto py-2 custom-scrollbar">
                <Flashcard 
                    word={currentBatch[flashcardIndex]} 
                    speakFast={speakFast}
                    speakAI={speakAI}
                    aiLoading={aiAudioLoading}
                    onToggleMastered={handleToggleMastered}
                    onToggleFavorite={handleToggleFavorite}
                />
            </div>

            <div className="p-6 grid grid-cols-2 gap-4 shrink-0 bg-gray-100 border-t-2 border-slate-200 pb-10 lg:pb-6">
                <button 
                    onClick={prevCard}
                    disabled={flashcardIndex === 0}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-slate-400 border-2 border-slate-200 border-b-4 hover:bg-slate-200 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:active:translate-y-0 disabled:active:border-b-4 transition-all uppercase tracking-wide"
                >
                    <ChevronLeft className="w-5 h-5" />
                    {t.prev}
                </button>
                <button 
                    onClick={nextCard}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-white bg-green-500 border-green-600 border-b-4 hover:bg-green-400 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wide"
                >
                    {flashcardIndex === currentBatch.length - 1 ? t.complete : t.next}
                    {flashcardIndex < currentBatch.length - 1 ? <ChevronRight className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </button>
            </div>
        </div>
      )}

      {/* COMPLETE */}
      {mode === AppMode.COMPLETE && t && (
         <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-500 overflow-y-auto bg-gray-100">
            <div className="mb-8 relative">
                <div className="absolute inset-0 bg-yellow-200 rounded-full blur-3xl opacity-50"></div>
                <CheckCircle className="w-24 h-24 text-yellow-400 relative z-10" />
            </div>
            
            <h2 className="text-3xl font-black text-slate-700 mb-4">{t.excellent}</h2>
            <p className="text-slate-400 font-medium text-lg mb-12">{t.lessonComplete}</p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-12">
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
                     <p className="text-xs text-slate-400 font-extrabold uppercase">{t.totalWords}</p>
                     <p className="text-2xl font-black text-slate-700">{currentBatch.length}</p>
                </div>
                 <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
                     <p className="text-xs text-slate-400 font-extrabold uppercase">{t.mastered}</p>
                     <p className="text-2xl font-black text-green-500">{currentBatch.filter(w => w.mastered).length}</p>
                </div>
            </div>

            <div className="space-y-4 w-full max-w-xs">
                <button 
                    onClick={handleStartReview}
                    className="w-full py-4 bg-white border-2 border-slate-200 border-b-4 text-slate-500 rounded-2xl font-extrabold hover:bg-slate-50 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
                >
                    {t.reviewMore}
                </button>
                <button 
                    onClick={() => setMode(AppMode.DASHBOARD)}
                    className="w-full py-4 bg-green-500 border-green-600 border-b-4 text-white rounded-2xl font-extrabold hover:bg-green-400 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider"
                >
                    {t.continue}
                </button>
            </div>
         </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && selectedLang && t && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col border-2 border-slate-200">
                <div className="p-4 border-b-2 border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-extrabold text-slate-700">{t.profile} ({selectedLang.toUpperCase()})</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="bg-sky-50 p-4 rounded-2xl border-2 border-sky-100 flex items-start gap-3">
                         <AlertTriangle className="w-6 h-6 text-sky-500 shrink-0" />
                         <p className="text-sm text-sky-600 font-medium">
                             {t.backupDesc}
                         </p>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={handleExport}
                            className="w-full py-4 bg-white text-slate-600 border-2 border-slate-200 border-b-4 rounded-2xl font-extrabold hover:bg-slate-50 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            <Download className="w-5 h-5" />
                            {t.downloadData}
                        </button>
                        
                        <button 
                            onClick={handleImportClick}
                            className="w-full py-4 bg-white text-slate-600 border-2 border-slate-200 border-b-4 rounded-2xl font-extrabold hover:bg-slate-50 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            <Upload className="w-5 h-5" />
                            {t.uploadData}
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden" 
                            accept=".json"
                            onChange={handleFileChange}
                        />
                        
                        <button 
                            onClick={() => {
                                setIsSettingsOpen(false);
                                setSelectedLang(null);
                            }}
                            className="w-full py-4 bg-rose-50 text-rose-500 border-2 border-rose-100 border-b-4 rounded-2xl font-extrabold hover:bg-rose-100 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-wide mt-4"
                        >
                            <LogOut className="w-5 h-5" />
                            {t.changeLang}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}