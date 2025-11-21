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
  speakBestAvailable: (text: string, onEnd?: () => void) => void;
  aiLoading: boolean;
  currentLang: Language;
  onToggleMastered: (id: string, status: boolean) => void;
  onToggleFavorite: (id: string, status: boolean) => void;
  playbackSpeed?: number;
  swipeAutoplay: boolean;
  fontSize?: FontSize;
}

export const StudyList: React.FC<StudyListProps> = ({ 
    words, title, onComplete, onBackToHome, speakFast, speakAI, speakBestAvailable, aiLoading, currentLang,
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
  
  // --- SWIPE ANIMATION STATE ---
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // For the fly-out animation
  const startXRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // --- SWIPE HANDLERS ---
  const onTouchStart = (e: React.TouchEvent) => {
      if (isAutoPlaying || isAnimating) return;
      startXRef.current = e.targetTouches[0].clientX;
      setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
      if (!startXRef.current || isAutoPlaying || isAnimating) return;
      const currentX = e.targetTouches[0].clientX;
      const diff = currentX - startXRef.current;
      setSwipeX(diff);
  };

  const onTouchEnd = () => {
      if (!startXRef.current || isAutoPlaying || isAnimating) return;
      setIsDragging(false);
      const threshold = 100; // Pixel threshold to trigger swipe

      if (swipeX > threshold) {
          // Swiped Right -> Prev
          if (currentIndex > 0) {
              animateSwipe('right');
          } else {
              resetSwipe();
          }
      } else if (swipeX < -threshold) {
          // Swiped Left -> Next
          if (currentIndex < words.length - 1) {
              animateSwipe('left');
          } else {
               resetSwipe();
          }
      } else {
          resetSwipe();
      }
      startXRef.current = null;
  };

  const animateSwipe = (direction: 'left' | 'right') => {
      setIsAnimating(true);
      // Fly out animation
      setSwipeX(direction === 'left' ? -500 : 500); 
      
      setTimeout(() => {
          // Actual data change
          if (direction === 'left') {
              handleNext(false); // False = don't trigger basic transition, we handle it
          } else {
              handlePrev(false);
          }
          
          // Reset position instantly (while invisible or swapped)
          setSwipeX(0);
          setIsAnimating(false);
      }, 200); // Match CSS duration
  };

  const resetSwipe = () => {
      setSwipeX(0);
  };

  const startAutoPlay = () => {
      if (words.length === 0) return;
      setIsAutoPlaying(true);
      setIsPaused(false);
      setShowSettings(false);
      setSwipeX(0); // Reset any drag
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

  const handleNext = (animate = true) => {
      if (currentIndex < words.length - 1) {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          if (swipeAutoplay) {
              // Use Best Available (Cached AI or Fast)
              setTimeout(() => speakBestAvailable(words[nextIndex].target), 400);
          }
      }
  };

  const handlePrev = (animate = true) => {
      if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          setCurrentIndex(prevIndex);
          if (swipeAutoplay) {
              // Use Best Available (Cached AI or Fast)
              setTimeout(() => speakBestAvailable(words[prevIndex].target), 400);
          }
      }
  };

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
         // Use Best Available (Cached AI or Fast)
         speakBestAvailable(word.target, playNext);
    }, 500);

    return () => {
        clearTimeout(initialDelay);
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [currentIndex, isAutoPlaying, isPaused, words, speakBestAvailable, playDelay]);


  const currentWord = words[currentIndex];

  // Calculate Styles for Swipe
  const getCardStyle = () => {
      const rotation = swipeX / 20; // Rotate 1 deg for every 20px moved
      const opacity = 1 - Math.abs(swipeX) / 500; // Fade out as it leaves
      
      return {
          transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
          opacity: opacity,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
          cursor: isDragging ? 'grabbing' : 'grab'
      };
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full relative bg-gray-100 overflow-hidden">
        
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

      {/* Flashcard View with Physics Swipe */}
      <div 
        className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
         {!isAutoPlaying && (
             <div className="absolute top-1/2 left-2 transform -translate-y-1/2 z-10">
                 <button 
                    onClick={() => animateSwipe('right')} 
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
                    onClick={() => animateSwipe('left')} 
                    disabled={currentIndex === words.length - 1}
                    className="p-2 bg-white rounded-full shadow-md text-slate-400 disabled:opacity-30 hover:text-sky-500 hover:scale-110 transition-all"
                 >
                     <ChevronRight className="w-8 h-8" />
                 </button>
             </div>
         )}

         {currentWord && (
             <div 
                ref={cardRef}
                style={getCardStyle()}
                className="w-full"
             >
                 <Flashcard 
                    key={currentWord.id}
                    word={currentWord}
                    speakFast={speakFast}
                    speakAI={speakAI}
                    speakBestAvailable={speakBestAvailable}
                    aiLoading={aiLoading}
                    onToggleMastered={onToggleMastered}
                    onToggleFavorite={onToggleFavorite}
                    currentLang={currentLang}
                    fontSize={fontSize} 
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