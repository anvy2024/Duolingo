
import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, Language } from '../types';
import { Zap, Sparkles, ArrowRight, Volume2, Home, Heart, CheckCircle, Circle, Play, Pause, Square, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Flashcard } from './Flashcard';
import { TRANSLATIONS } from '../constants/translations';
import { FontSize } from '../App';

interface StudyListProps {
  words: VocabularyWord[];
  title?: string;
  onComplete: () => void;
  onBackToHome: () => void;
  speakFast: (text: string, onEnd?: () => void) => void;
  speakAI: (text: string) => void;
  aiLoading: boolean;
  currentLang: Language;
  onToggleMastered: (id: string, status: boolean) => void;
  onToggleFavorite: (id: string, status: boolean) => void;
  playbackSpeed?: number;
  swipeAutoplay: boolean;
  fontSize?: FontSize;
}

export const StudyList: React.FC<StudyListProps> = ({ 
    words, title, onComplete, onBackToHome, speakFast, speakAI, aiLoading, currentLang,
    onToggleMastered, onToggleFavorite, playbackSpeed = 1.0, swipeAutoplay,
    fontSize = 'normal'
}) => {
  const t = TRANSLATIONS[currentLang];

  // --- AUTO PLAY STATE ---
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playDelay, setPlayDelay] = useState(2000); // Default 2s
  const [showSettings, setShowSettings] = useState(false);
  
  // Swipe State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Refs for loop management
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
      isMountedRef.current = true;
      return () => {
          isMountedRef.current = false;
          if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
          window.speechSynthesis.cancel();
      };
  }, []);

  const startAutoPlay = () => {
      if (words.length === 0) return;
      setIsAutoPlaying(true);
      setIsPaused(false);
      setShowSettings(false);
  };

  const stopAutoPlay = () => {
      setIsAutoPlaying(false);
      setIsPaused(false);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      window.speechSynthesis.cancel();
  };

  const togglePause = () => {
      if (isPaused) {
          setIsPaused(false);
      } else {
          setIsPaused(true);
          if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
          window.speechSynthesis.cancel();
      }
  };

  const handleNext = () => {
      if (currentIndex < words.length - 1) {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          if (swipeAutoplay) {
              setTimeout(() => speakFast(words[nextIndex].target), 300);
          }
      } else {
          // Optionally loop or stop
      }
  };

  const handlePrev = () => {
      if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          setCurrentIndex(prevIndex);
          if (swipeAutoplay) {
              setTimeout(() => speakFast(words[prevIndex].target), 300);
          }
      }
  };

  // Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
  }

  const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX);
  }

  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;
      
      if (isLeftSwipe) {
          handleNext();
      }
      if (isRightSwipe) {
          handlePrev();
      }
  }

  // THE AUTO PLAY LOOP
  useEffect(() => {
    if (!isAutoPlaying || isPaused) return;

    if (currentIndex >= words.length) {
        stopAutoPlay();
        return;
    }

    const word = words[currentIndex];
    
    // Logic to play and advance
    let hasAdvanced = false;
    
    const playNext = () => {
        if (hasAdvanced || !isMountedRef.current || !isAutoPlaying || isPaused) return;
        hasAdvanced = true;
        loopTimeoutRef.current = setTimeout(() => {
             if (currentIndex < words.length - 1) {
                 setCurrentIndex(prev => prev + 1);
             } else {
                 stopAutoPlay();
             }
        }, playDelay);
    };

    const initialDelay = setTimeout(() => {
         speakFast(word.target, playNext);
    }, 500);

    return () => {
        clearTimeout(initialDelay);
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [currentIndex, isAutoPlaying, isPaused, words, speakFast, playDelay]);


  const currentWord = words[currentIndex];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full relative bg-gray-100">
        
      {/* Header Bar */}
      <div className="bg-gray-100/95 backdrop-blur p-4 flex justify-between items-center border-b-2 border-slate-200 sticky top-0 z-20">
            <div className="flex items-center gap-2">
                <button onClick={onBackToHome} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                </button>
                <div className="flex flex-col">
                     <h3 className="font-extrabold text-slate-700 text-lg leading-none">{title || t.newVocab}</h3>
                     <span className="text-xs font-bold text-slate-400 uppercase">
                        {currentIndex + 1} / {words.length}
                     </span>
                </div>
            </div>
            
            {isAutoPlaying ? (
                // AUTO PLAY CONTROLS
                <div className="flex items-center gap-2 animate-in slide-in-from-right duration-300">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-xl ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}
                    >
                        <Clock className="w-5 h-5" />
                    </button>

                    <button 
                        onClick={togglePause}
                        className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 shadow-sm"
                    >
                        {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                    </button>

                    <button 
                        onClick={stopAutoPlay}
                        className="p-2 rounded-xl bg-rose-100 text-rose-500 hover:bg-rose-200"
                    >
                        <Square className="w-5 h-5 fill-current" />
                    </button>
                </div>
            ) : (
                // NORMAL PLAY START BUTTON
                <button 
                    onClick={startAutoPlay}
                    className="flex items-center justify-center p-2 bg-indigo-500 text-white rounded-xl border-indigo-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                    title={t.autoPlay}
                >
                    <Play className="w-5 h-5" />
                </button>
            )}
      </div>

      {/* Auto Play Settings Dropdown */}
      {isAutoPlaying && showSettings && (
          <div className="absolute top-[72px] right-4 w-48 bg-white rounded-xl shadow-xl border-2 border-slate-100 p-3 z-30 animate-in slide-in-from-top-2">
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
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
          </div>
      )}

      {/* Single Flashcard View with Swipe */}
      <div 
        className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
         {!isAutoPlaying && (
             <div className="absolute top-1/2 left-2 transform -translate-y-1/2 z-10">
                 <button 
                    onClick={handlePrev} 
                    disabled={currentIndex === 0}
                    className="p-2 bg-white rounded-full shadow-md text-slate-400 disabled:opacity-30 hover:text-sky-500 hover:scale-110 transition-all"
                 >
                     <ChevronLeft className="w-8 h-8" />
                 </button>
             </div>
         )}
         
         {!isAutoPlaying && (
             <div className="absolute top-1/2 right-2 transform -translate-y-1/2 z-10">
                 <button 
                    onClick={handleNext} 
                    disabled={currentIndex === words.length - 1}
                    className="p-2 bg-white rounded-full shadow-md text-slate-400 disabled:opacity-30 hover:text-sky-500 hover:scale-110 transition-all"
                 >
                     <ChevronRight className="w-8 h-8" />
                 </button>
             </div>
         )}

         {currentWord && (
             <div className="w-full animate-in zoom-in duration-300">
                 <Flashcard 
                    key={currentWord.id}
                    word={currentWord}
                    speakFast={speakFast}
                    speakAI={speakAI}
                    aiLoading={aiLoading}
                    onToggleMastered={onToggleMastered}
                    onToggleFavorite={onToggleFavorite}
                    currentLang={currentLang}
                    fontSize={fontSize} // Pass fontSize
                 />
             </div>
         )}
      </div>
      
      {/* Footer Progress */}
      <div className="p-4 bg-white border-t-2 border-slate-200">
         <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
             <div 
                className="bg-green-500 h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
             ></div>
         </div>
      </div>

    </div>
  );
};