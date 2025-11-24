import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, Language } from '../types';
import { Volume2, CheckCircle, Circle, Zap, Loader2, Heart, Radio, Sparkles } from 'lucide-react';
import { FontSize } from '../App';

interface FlashcardProps {
  word: VocabularyWord;
  speakFast: (text: string, onEnd?: () => void) => void;
  speakAI: (text: string) => void;
  speakBestAvailable?: (text: string, onEnd?: () => void) => void;
  aiLoading: boolean;
  onToggleMastered?: (id: string, currentStatus: boolean) => void;
  onToggleFavorite?: (id: string, currentStatus: boolean) => void;
  isViewMode?: boolean;
  currentLang?: Language; 
  fontSize?: FontSize; 
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, speakFast, speakAI, speakBestAvailable, aiLoading, onToggleMastered, onToggleFavorite, isViewMode = false, currentLang = 'fr', fontSize = 'normal' }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const isMountedRef = useRef(false);
  
  // Reset flip when word changes
  useEffect(() => {
    setIsFlipped(false);
    isMountedRef.current = false; 
    const t = setTimeout(() => { isMountedRef.current = true; }, 500);
    return () => clearTimeout(t);
  }, [word.id]);

  // Audio logic on flip
  useEffect(() => {
    if (speakBestAvailable && isMountedRef.current) {
        if (isFlipped) {
            // Front -> Back: Play Example
            const timer = setTimeout(() => {
                speakBestAvailable(word.example.target);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            // Back -> Front: Play Target Word
            const timer = setTimeout(() => {
                speakBestAvailable(word.target);
            }, 300);
            return () => clearTimeout(timer);
        }
    }
  }, [isFlipped, speakBestAvailable, word.example.target, word.target]);

  // Keyboard Shortcut: Arrow Up to Flip
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'ArrowUp') {
              e.preventDefault(); // Prevent scrolling
              setIsFlipped(prev => !prev);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent flip if clicking specific buttons
    if ((e.target as HTMLElement).closest('button')) return;
    setIsFlipped(!isFlipped);
  };

  const handleAudioClick = (e: React.MouseEvent, type: 'fast' | 'ai', text: string) => {
    e.stopPropagation(); 
    if (type === 'fast') {
        speakFast(text);
    } else {
        speakAI(text);
    }
  };
  
  const handleMasterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleMastered) {
        onToggleMastered(word.id, !word.mastered);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleFavorite) {
          onToggleFavorite(word.id, !word.isFavorite);
      }
  };

  const isPhraseMode = word.target.length > 50 || (word.target === word.example.target);
  const displayTarget = word.target;

  // Helper to parse Example Pronunciation (ZH handles separate Pinyin/Bồi)
  const getExamplePronunciation = (isFront: boolean = false) => {
      if (!word.example.viet_pronunciation) return null;
      
      const textColor = isFront ? 'text-slate-400' : 'text-slate-500';
      const boiColor = isFront ? 'text-orange-400' : 'text-orange-500';

      // Check for separator '||' used in Gemini prompt for Chinese (legacy)
      if (word.example.viet_pronunciation.includes('||')) {
          const parts = word.example.viet_pronunciation.split('||');
          return (
              <div className="flex flex-col gap-0.5 mt-1 text-center">
                  <span className={`text-xs font-mono ${textColor}`}>{parts[0].trim()}</span>
                  <span className={`text-xs italic ${boiColor}`}>{parts[1].trim()}</span>
              </div>
          );
      }
      
      // If language is Chinese but no separator, assume Pinyin for new data
      if (currentLang === 'zh') {
           return <p className={`italic text-sm mt-1 text-indigo-500 font-medium font-sans`}>{word.example.viet_pronunciation}</p>;
      }
      
      return <p className={`italic text-xs mb-3 ${textColor}`}>{word.example.viet_pronunciation}</p>;
  };

  // Dynamic Font Size Logic
  const getFontSize = (text: string) => {
      const len = text.length;
      if (fontSize === 'huge') {
           if (len > 80) return 'text-2xl leading-normal text-left';
           if (len > 40) return 'text-3xl leading-tight font-bold';
           if (len > 15) return 'text-5xl font-extrabold';
           return 'text-6xl font-black'; 
      }
      if (fontSize === 'large') {
           if (len > 80) return 'text-xl leading-normal text-left';
           if (len > 40) return 'text-3xl leading-tight font-bold';
           if (len > 15) return 'text-4xl font-extrabold';
           return 'text-5xl font-black';
      }
      if (len > 80) return 'text-xl leading-normal text-left';
      if (len > 40) return 'text-2xl leading-tight font-bold';
      if (len > 15) return 'text-3xl font-extrabold';
      return 'text-5xl font-black'; 
  };

  const getExampleSize = () => {
      if (fontSize === 'huge') return 'text-xl font-bold leading-relaxed';
      if (fontSize === 'large') return 'text-lg font-medium leading-relaxed';
      return 'text-sm font-medium leading-relaxed';
  }

  const getBackMeaningSize = () => {
      if (fontSize === 'huge') return 'text-4xl font-black leading-tight';
      if (fontSize === 'large') return 'text-3xl font-black leading-tight';
      return 'text-2xl font-black leading-tight';
  }

  const getBackExampleTargetSize = () => {
      if (fontSize === 'huge') return 'text-2xl font-bold leading-snug';
      if (fontSize === 'large') return 'text-xl font-bold leading-snug';
      return 'text-lg font-bold leading-snug';
  }

  return (
    <div 
        className={`w-full max-w-[340px] sm:max-w-sm mx-auto my-4 perspective-1000 ${isViewMode ? 'h-[450px]' : 'h-[540px]'}`} 
    >
      <div 
        className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
        onClick={handleCardClick}
      >
        
        {/* --- FRONT SIDE --- */}
        <div 
            className="absolute inset-0 backface-hidden bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 border-b-[6px] p-6 flex flex-col justify-between z-20 overflow-hidden"
        >
          {/* Header: Badge & Icons */}
          <div className="flex justify-between items-start w-full shrink-0">
             <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl ${
                 word.category === 'common-verbs' ? 'bg-sky-100 text-sky-600' : 
                 word.category === 'irregular-verbs' ? 'bg-purple-100 text-purple-600' : 
                 'bg-slate-100 text-slate-500'
             }`}>
                {word.category === 'common-verbs' ? 'Verbe' : word.category === 'irregular-verbs' ? 'Irrégulier' : 'Mot'}
             </span>
             
             <div className="flex gap-2">
                {onToggleFavorite && (
                    <button onClick={handleFavoriteClick} className={`p-2 rounded-full transition-colors ${word.isFavorite ? 'bg-rose-100 text-rose-500' : 'bg-slate-50 text-slate-300'}`}>
                        <Heart className={`w-5 h-5 ${word.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                )}
                {onToggleMastered && (
                   <button onClick={handleMasterClick} className={`p-2 rounded-full transition-colors ${word.mastered ? 'bg-green-100 text-green-500' : 'bg-slate-50 text-slate-300'}`}>
                       {word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                   </button>
                )}
             </div>
          </div>

          {/* Center: Main Word */}
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-2 overflow-y-auto custom-scrollbar">
            <div className={`${getFontSize(displayTarget)} text-slate-800 break-words w-full px-2`}>
                {displayTarget}
            </div>
            
            {/* Pronunciation Display on Front */}
            <div className="flex flex-col items-center gap-1">
                {word.ipa && (
                    <span className="font-mono text-slate-400 text-sm font-medium bg-slate-50 px-2 py-0.5 rounded">
                        {word.ipa}
                    </span>
                )}
                {word.viet_pronunciation && (
                    <span className="text-orange-500 text-sm font-bold italic">
                        {word.viet_pronunciation}
                    </span>
                )}
            </div>
            
            {/* Main Word Audio Buttons */}
            <div className="flex items-center gap-4 shrink-0 mt-2">
                <button 
                    onClick={(e) => handleAudioClick(e, 'fast', displayTarget)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-sky-100 hover:text-sky-600 transition-colors active:scale-95"
                    title="Đọc nhanh"
                >
                    <Zap className="w-6 h-6 fill-current" />
                </button>
                <button 
                    onClick={(e) => handleAudioClick(e, 'ai', displayTarget)}
                    className="w-14 h-14 flex items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-200 hover:bg-sky-400 transition-all active:scale-95"
                    disabled={aiLoading}
                    title="Đọc AI"
                >
                    {aiLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Radio className="w-7 h-7" />}
                </button>
            </div>
          </div>

          {/* Bottom: Example Sentence (Front) */}
          {!isPhraseMode && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shrink-0" onClick={(e) => e.stopPropagation()}>
                   <p className={`text-slate-600 text-center italic mb-2 line-clamp-3 ${getExampleSize()}`}>
                       "{word.example.target}"
                   </p>
                   
                   {/* SHOW PRONUNCIATION ON FRONT FOR CHINESE */}
                   {currentLang === 'zh' && getExamplePronunciation(true)}

                   {/* RESTORED AUDIO BUTTONS FOR EXAMPLE */}
                   <div className="flex justify-center gap-3 mt-2">
                        <button 
                            onClick={(e) => handleAudioClick(e, 'fast', word.example.target)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:border-sky-200 hover:text-sky-500 transition-all shadow-sm active:scale-95"
                        >
                            <Zap className="w-3 h-3" /> Fast
                        </button>
                        <button 
                            onClick={(e) => handleAudioClick(e, 'ai', word.example.target)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 text-xs font-bold text-indigo-500 hover:bg-indigo-100 transition-all shadow-sm active:scale-95"
                            disabled={aiLoading}
                        >
                            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI
                        </button>
                   </div>
              </div>
          )}
        </div>

        {/* --- BACK SIDE --- */}
        <div 
            className="absolute inset-0 backface-hidden bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 border-b-[6px] p-6 flex flex-col rotate-y-180 overflow-hidden z-20"
        >
             {/* Header: Meaning */}
             <div className="border-b-2 border-slate-100 pb-4 mb-4 text-left shrink-0">
                 <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Ý nghĩa</span>
                 <h3 className={`${getBackMeaningSize()} text-slate-800`}>{word.vietnamese}</h3>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 text-left">
                 {/* Pronunciation Box */}
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                         <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">IPA</span>
                         <span className={`font-mono text-slate-600 font-medium ${fontSize === 'huge' ? 'text-lg' : 'text-sm'}`}>{word.ipa}</span>
                    </div>
                    {word.viet_pronunciation && (
                        <div className="flex items-center gap-3">
                            <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded">Bồi</span>
                            <span className={`text-orange-600 font-bold italic ${fontSize === 'huge' ? 'text-xl' : 'text-lg'}`}>{word.viet_pronunciation}</span>
                        </div>
                    )}
                 </div>

                 {/* Example Box (Detailed) */}
                 <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 shrink-0">
                      <span className="text-[10px] font-black text-sky-400 uppercase mb-2 block">Ví dụ chi tiết</span>
                      <p className={`text-slate-700 mb-1 ${getBackExampleTargetSize()}`}>{word.example.target}</p>
                      
                      {/* Handle detailed pronunciation for Chinese examples */}
                      {getExamplePronunciation(false)}

                      <div className="h-px bg-sky-200 w-full my-2"></div>
                      <p className={`text-slate-600 font-medium italic ${fontSize === 'huge' ? 'text-lg' : 'text-base'}`}>"{word.example.vietnamese}"</p>
                      
                      <div className="flex justify-end gap-2 mt-3">
                           <button 
                                onClick={(e) => handleAudioClick(e, 'fast', word.example.target)}
                                className="p-2 bg-white rounded-lg text-sky-500 shadow-sm hover:scale-105 transition-transform"
                           >
                               <Volume2 className="w-4 h-4" />
                           </button>
                           <button 
                                onClick={(e) => handleAudioClick(e, 'ai', word.example.target)}
                                className="p-2 bg-sky-500 rounded-lg text-white shadow-sm hover:scale-105 transition-transform"
                           >
                               <Sparkles className="w-4 h-4" />
                           </button>
                      </div>
                 </div>
             </div>
        </div>

      </div>
    </div>
  );
};