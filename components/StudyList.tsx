
import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, Language } from '../types';
import { Zap, Sparkles, ArrowRight, Volume2, Home, Heart, CheckCircle, Circle, Play, Pause, Square, Clock, X } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';

interface StudyListProps {
  words: VocabularyWord[];
  title?: string;
  onComplete: () => void;
  onBackToHome: () => void;
  speakFast: (text: string) => void;
  speakAI: (text: string) => void;
  aiLoading: boolean;
  currentLang: Language;
  onToggleMastered: (id: string, status: boolean) => void;
  onToggleFavorite: (id: string, status: boolean) => void;
}

export const StudyList: React.FC<StudyListProps> = ({ 
    words, title, onComplete, onBackToHome, speakFast, speakAI, aiLoading, currentLang,
    onToggleMastered, onToggleFavorite
}) => {
  const t = TRANSLATIONS[currentLang];

  // --- AUTO PLAY STATE ---
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playQueue, setPlayQueue] = useState<VocabularyWord[]>([]);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [playDelay, setPlayDelay] = useState(2000); // Default 2s
  const [showSettings, setShowSettings] = useState(false);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop autoplay on unmount
  useEffect(() => {
    return () => {
        if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
        window.speechSynthesis.cancel();
    };
  }, []);

  const startAutoPlay = () => {
      if (words.length === 0) return;
      // Auto play follows the current list order, or you can shuffle if desired. 
      // For study list (review), sticking to order might be better, but user asked for random.
      // However, App.tsx already shuffled the list passed to `words` prop for review/favorites.
      // So we just play `words` as is.
      setPlayQueue(words);
      setCurrentPlayIndex(0);
      setIsAutoPlaying(true);
      setIsPaused(false);
      setShowSettings(false);
  };

  const stopAutoPlay = () => {
      setIsAutoPlaying(false);
      setIsPaused(false);
      setPlayQueue([]);
      setCurrentPlayIndex(0);
      window.speechSynthesis.cancel();
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
  };

  const togglePause = () => {
      if (isPaused) {
          setIsPaused(false);
          window.speechSynthesis.cancel(); // Logic restart loop
      } else {
          setIsPaused(true);
          window.speechSynthesis.cancel();
          if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      }
  };

  useEffect(() => {
    if (!isAutoPlaying || isPaused) return;

    if (currentPlayIndex >= playQueue.length) {
        stopAutoPlay();
        return;
    }

    const word = playQueue[currentPlayIndex];
    
    // Scroll to word
    const el = document.getElementById(`study-word-${word.id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const speakCurrent = () => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word.target);
        
        if (currentLang === 'fr') utterance.lang = 'fr-FR';
        else if (currentLang === 'en') utterance.lang = 'en-US';
        else if (currentLang === 'zh') utterance.lang = 'zh-CN';
        else if (currentLang === 'es') utterance.lang = 'es-ES';

        utterance.rate = 1.0; // Use standard speed or pass prop if needed

        const voices = window.speechSynthesis.getVoices();
        const langPrefix = currentLang === 'zh' ? 'zh' : currentLang;
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith(langPrefix) && 
            (voice.name.includes('Google') || voice.name.includes('Premium') || !voice.localService)
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => {
            playTimeoutRef.current = setTimeout(() => {
                setCurrentPlayIndex(prev => prev + 1);
            }, playDelay);
        };
        
        utterance.onerror = () => {
             playTimeoutRef.current = setTimeout(() => {
                setCurrentPlayIndex(prev => prev + 1);
            }, 1000);
        };

        synthRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    };

    const startDelay = setTimeout(speakCurrent, 500);

    return () => {
        clearTimeout(startDelay);
        if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
        window.speechSynthesis.cancel();
    };
  }, [currentPlayIndex, isAutoPlaying, isPaused, playQueue]);

  const currentPlayingId = (isAutoPlaying && playQueue[currentPlayIndex]) ? playQueue[currentPlayIndex].id : null;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full relative">
        
      {/* Header Bar */}
      <div className="bg-gray-100 p-4 flex justify-between items-center border-b-2 border-slate-200 sticky top-0 z-10">
            <div className="flex items-center gap-2">
                <button onClick={onBackToHome} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                </button>
                <div className="flex flex-col">
                     <h3 className="font-extrabold text-slate-700 text-lg leading-none">{title || t.newVocab}</h3>
                     <span className="text-xs font-bold text-slate-400 uppercase">{words.length} words</span>
                </div>
            </div>
            
            {!isAutoPlaying && (
                <button 
                    onClick={startAutoPlay}
                    className="flex items-center justify-center p-2 bg-indigo-500 text-white rounded-xl border-indigo-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                    title={t.autoPlay}
                >
                    <Play className="w-5 h-5" />
                </button>
            )}
      </div>

      {/* List Content */}
      <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${isAutoPlaying ? 'pb-48' : 'pb-24'}`}>
        
        {!isAutoPlaying && (
             <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 mb-4 text-center shadow-sm">
                <p className="text-slate-500 font-medium mb-4">{t.introText}</p>
                <button 
                    onClick={onComplete}
                    className="w-full bg-green-500 text-white border-green-600 border-b-4 active:border-b-0 active:translate-y-1 px-6 py-3 rounded-xl text-base font-extrabold uppercase tracking-wide hover:bg-green-400 transition-all flex items-center justify-center gap-2"
                >
                    {t.startPractice}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        )}

        <div className="space-y-4">
            {words.map((word, idx) => {
                const isPlayingThis = word.id === currentPlayingId;
                return (
                    <div 
                        key={word.id} 
                        id={`study-word-${word.id}`}
                        className={`rounded-2xl p-5 border-2 border-b-4 flex flex-col gap-4 relative transition-all duration-500 ${
                            isPlayingThis 
                            ? 'bg-yellow-50 border-yellow-400 scale-105 shadow-lg z-10' 
                            : 'bg-white border-slate-200'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1 mr-2">
                                <div className="flex items-center gap-3">
                                    <span className={`font-extrabold px-2 py-1 rounded-lg text-xs ${isPlayingThis ? 'bg-yellow-200 text-yellow-700' : 'bg-slate-100 text-slate-400'}`}>#{idx + 1}</span>
                                    <h3 className={`text-2xl font-black ${isPlayingThis ? 'text-slate-800' : 'text-slate-700'}`}>{word.target}</h3>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="text-sm font-mono text-slate-500 border border-slate-200 px-1.5 rounded bg-white">{word.ipa}</span>
                                    {word.viet_pronunciation && (
                                        <span className="text-sm text-sky-500 font-bold italic">({word.viet_pronunciation})</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex gap-2 shrink-0">
                                {!isAutoPlaying && (
                                    <>
                                         <button 
                                            onClick={() => speakAI(word.target)}
                                            disabled={aiLoading}
                                            className="p-3 rounded-xl bg-sky-500 text-white border-sky-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all hover:bg-sky-400 disabled:opacity-50"
                                        >
                                            <Sparkles className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => speakFast(word.target)}
                                            className="p-3 rounded-xl bg-slate-100 text-slate-400 border-2 border-slate-200 border-b-4 hover:text-sky-500 hover:bg-slate-200 active:border-b-0 active:translate-y-1 transition-all"
                                        >
                                            <Zap className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                                {isPlayingThis && <Volume2 className="w-8 h-8 text-yellow-500 animate-bounce" />}
                            </div>
                        </div>
                        
                        <div className={`border-t-2 pt-3 ${isPlayingThis ? 'border-yellow-200' : 'border-slate-100'}`}>
                            <p className="font-extrabold text-lg text-slate-600 mb-3">{word.vietnamese}</p>
                            
                            <div className={`rounded-xl p-4 border-2 ${isPlayingThis ? 'bg-white border-yellow-200' : 'bg-sky-50 border-sky-100'}`}>
                                <div className="flex justify-between items-start gap-2">
                                    <p className="text-slate-700 font-bold text-base leading-relaxed">{word.example.target}</p>
                                    {!isAutoPlaying && (
                                        <button 
                                            onClick={() => speakFast(word.example.target)} 
                                            className="text-sky-500 hover:text-sky-400 shrink-0 active:scale-90 transition-transform"
                                        >
                                            <Volume2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                {word.example.viet_pronunciation && (
                                    <p className="text-slate-500 italic text-xs font-medium mt-1">{word.example.viet_pronunciation}</p>
                                )}
                                <p className="text-slate-500 font-medium mt-2">{word.example.vietnamese}</p>
                            </div>
                        </div>

                        {/* Action Bar - Only show if not auto playing to reduce clutter, or keep simple */}
                        {!isAutoPlaying && (
                            <div className="flex justify-end items-center gap-2 pt-2">
                                <button 
                                    onClick={() => onToggleFavorite(word.id, !!word.isFavorite)}
                                    className={`p-2 rounded-xl border-2 transition-all ${word.isFavorite ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-slate-200 text-slate-300 hover:border-rose-200 hover:text-rose-400'}`}
                                >
                                    <Heart className={`w-5 h-5 ${word.isFavorite ? 'fill-rose-500' : ''}`} />
                                </button>
                                <button 
                                    onClick={() => onToggleMastered(word.id, !!word.mastered)}
                                    className={`p-2 rounded-xl border-2 transition-all ${word.mastered ? 'bg-green-50 border-green-200 text-green-500' : 'bg-white border-slate-200 text-slate-300 hover:border-green-200 hover:text-green-500'}`}
                                >
                                    {word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                </button>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
      </div>

      {/* AUTO PLAY CONTROLS BAR */}
      {isAutoPlaying && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-lg bg-white/95 backdrop-blur-xl border-2 border-slate-200 shadow-2xl rounded-3xl p-4 flex flex-col gap-4 z-50 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                        {t.autoPlay} • {playQueue.length > 0 ? `${currentPlayIndex + 1}/${playQueue.length}` : '0/0'}
                    </span>
                    <span className="font-bold text-slate-700 truncate max-w-[150px]">
                        {playQueue[currentPlayIndex]?.target || '...'}
                    </span>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-3 rounded-xl ${showSettings ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400'}`}
                    >
                        <Clock className="w-5 h-5" />
                    </button>

                    <button 
                        onClick={togglePause}
                        className="w-14 h-14 rounded-2xl bg-indigo-500 text-white border-b-4 border-indigo-700 active:border-b-0 active:translate-y-1 flex items-center justify-center shadow-lg shadow-indigo-200"
                    >
                        {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                    </button>

                    <button 
                        onClick={stopAutoPlay}
                        className="p-3 rounded-xl bg-rose-100 text-rose-500 hover:bg-rose-200"
                    >
                        <Square className="w-5 h-5 fill-current" />
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="bg-slate-100 rounded-xl p-4 animate-in slide-in-from-top duration-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">{t.delay}: {playDelay/1000}s</span>
                    </div>
                    <input 
                        type="range" 
                        min="1000" 
                        max="5000" 
                        step="500"
                        value={playDelay}
                        onChange={(e) => setPlayDelay(Number(e.target.value))}
                        className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                        <span>1s</span>
                        <span>3s</span>
                        <span>5s</span>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};
