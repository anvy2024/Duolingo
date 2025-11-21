import React, { useState } from 'react';
import { VocabularyWord, Language } from '../types';
import { Volume2, CheckCircle, Circle, Zap, Loader2, Heart, Radio } from 'lucide-react';

interface FlashcardProps {
  word: VocabularyWord;
  speakFast: (text: string, onEnd?: () => void) => void;
  speakAI: (text: string) => void;
  aiLoading: boolean;
  onToggleMastered?: (id: string, currentStatus: boolean) => void;
  onToggleFavorite?: (id: string, currentStatus: boolean) => void;
  isViewMode?: boolean;
  currentLang?: Language; 
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, speakFast, speakAI, aiLoading, onToggleMastered, onToggleFavorite, isViewMode = false, currentLang = 'fr' }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Reset flip when word changes
  React.useEffect(() => {
    setIsFlipped(false);
  }, [word.id]);

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

  const getFontSize = (text: string) => {
      if (text.length > 100) return 'text-base leading-relaxed text-left px-2';
      if (text.length > 50) return 'text-lg leading-tight';
      if (text.length > 20) return 'text-xl';
      return 'text-3xl'; // Slightly smaller max font for shorter card
  };

  // Strict styles for iOS 3D transforms to prevent bleed-through
  const containerStyle: React.CSSProperties = {
      perspective: '1000px',
      WebkitPerspective: '1000px',
  };

  const transformStyle: React.CSSProperties = {
      transformStyle: 'preserve-3d',
      WebkitTransformStyle: 'preserve-3d',
  };

  const backfaceStyle: React.CSSProperties = {
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'white', // Ensure opacity
    borderRadius: '2rem',
  };

  return (
    // Height reduced to h-[380px] for mobile to fit buttons below
    <div 
        className={`w-full max-w-sm h-[380px] md:h-auto md:aspect-[3/5] ${isViewMode ? 'max-h-[55vh]' : 'max-h-[480px]'} mx-auto my-2 cursor-pointer group select-none`} 
        onClick={handleCardClick}
        style={containerStyle}
    >
      <div className={`relative w-full h-full transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`} style={transformStyle}>
        
        {/* FRONT SIDE */}
        <div 
            className={`border-2 border-slate-200 border-b-[8px] flex flex-col items-center justify-between p-5 shadow-xl bg-white z-10`}
            style={backfaceStyle}
        >
          
          {/* Top Row: Badges (Left) & Actions (Right) */}
          <div className="w-full flex justify-between items-start shrink-0 relative z-10">
             <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-lg border-b-2 ${
                 word.category === 'common-verbs' ? 'bg-sky-100 text-sky-600 border-sky-200' : 
                 word.category === 'irregular-verbs' ? 'bg-purple-100 text-purple-600 border-purple-200' : 
                 'bg-slate-100 text-slate-500 border-slate-200'
             }`}>
                {isPhraseMode ? 'Câu' : (word.category === 'common-verbs' ? 'Động từ' : word.category === 'irregular-verbs' ? 'Bất quy tắc' : 'Từ vựng')}
             </span>
             
             <div className="flex gap-2">
                {onToggleFavorite && (
                    <button
                        onClick={handleFavoriteClick}
                        className={`p-2 rounded-full transition-all border border-transparent ${
                            word.isFavorite
                            ? 'bg-rose-100 text-rose-500 shadow-sm'
                            : 'bg-slate-100 text-slate-300 hover:bg-rose-50 hover:text-rose-400 hover:border-rose-200'
                        }`}
                    >
                        <Heart className={`w-5 h-5 ${word.isFavorite ? 'fill-rose-500' : ''}`} />
                    </button>
                )}
                
                {onToggleMastered && (
                   <button 
                       onClick={handleMasterClick}
                       className={`p-2 rounded-full transition-all border border-transparent ${
                           word.mastered 
                           ? 'bg-green-100 text-green-500 shadow-sm' 
                           : 'bg-slate-100 text-slate-300 hover:bg-green-50 hover:text-green-400 hover:border-green-200'
                       }`}
                   >
                       {word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                   </button>
                )}
             </div>
          </div>

          {/* Main Word Display */}
          <div className="flex flex-col items-center justify-center w-full text-center flex-1 overflow-hidden py-2">
            <div className={`${getFontSize(displayTarget)} font-black text-slate-700 mb-4 break-words w-full tracking-tight overflow-y-auto max-h-[70%] custom-scrollbar px-2`}>
                {displayTarget}
            </div>
            
            {/* AUDIO BUTTONS */}
            <div className="flex items-center justify-center gap-4 w-full shrink-0">
                <button 
                    onClick={(e) => handleAudioClick(e, 'fast', displayTarget)}
                    className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 border-2 border-slate-200 border-b-4 hover:bg-slate-200 hover:text-sky-500 hover:border-sky-300 active:border-b-0 active:translate-y-1 transition-all"
                    title="Đọc nhanh"
                >
                    <Zap className="w-5 h-5" />
                </button>

                <button 
                    onClick={(e) => handleAudioClick(e, 'ai', displayTarget)}
                    className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-sky-500 text-white border-sky-600 border-b-4 hover:bg-sky-400 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-sky-200"
                    disabled={aiLoading}
                    title="Đọc chuẩn (AI)"
                >
                    {aiLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Radio className="w-6 h-6" />
                    )}
                </button>
            </div>
          </div>

          {/* EXAMPLE SENTENCE AREA - FRONT */}
          <div className="w-full mb-1 shrink-0 z-10 text-center px-1 min-h-[40px] flex items-end justify-center">
               {!isPhraseMode && (
                   <div className="flex flex-col items-center gap-1 group/example w-full" onClick={(e) => e.stopPropagation()}>
                       <p className="text-xs leading-snug font-medium text-slate-500 italic line-clamp-2 w-full px-4">
                           "{word.example.target}"
                       </p>
                   </div>
               )}
          </div>
        </div>

        {/* BACK SIDE */}
        <div 
            className={`border-2 border-slate-200 border-b-[8px] rotate-y-180 flex flex-col p-5 overflow-hidden bg-white`}
            style={{...backfaceStyle, transform: 'rotateY(180deg)'}} // Explicit rotate for iOS
        >
             
             {/* Header: Vietnamese Meaning */}
             <div className="flex w-full justify-between items-start border-b-2 border-slate-100 pb-3 mb-3 shrink-0">
                 <div className="flex-1 pr-2 min-w-0 text-left">
                     <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Nghĩa tiếng Việt</p>
                     <h3 className="text-xl font-black text-slate-700 leading-tight break-words">{word.vietnamese}</h3>
                 </div>
                 {/* Fixed Action Container (Right Side) */}
                 <div className="shrink-0 ml-2">
                    <button 
                        onClick={(e) => handleAudioClick(e, 'fast', displayTarget)}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:text-sky-500 transition-colors"
                    >
                        <Zap className="w-5 h-5" />
                    </button>
                 </div>
             </div>

             {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 text-left">
                 
                 {/* Pronunciation Block */}
                 <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-100 shrink-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                         <span className="text-[10px] font-bold text-white bg-slate-400 px-1.5 py-0.5 rounded uppercase">IPA</span>
                         <span className="font-mono text-slate-600 text-sm font-medium tracking-wide break-all">{word.ipa}</span>
                    </div>
                    {word.viet_pronunciation && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-[10px] font-bold text-white bg-sky-400 px-1.5 py-0.5 rounded uppercase">Bồi</span>
                            <span className="italic text-sky-600 text-base font-bold break-words">{word.viet_pronunciation}</span>
                        </div>
                    )}
                 </div>

                 {/* Example Block - Redesigned to prevent overlap */}
                 {!isPhraseMode && (
                     <div className="flex-1 min-h-0">
                        <div className="p-3 rounded-xl bg-sky-50 border-2 border-sky-100 flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar">
                            <div className="shrink-0">
                                <p className="text-[10px] text-sky-500 uppercase font-bold mb-1">Ví dụ mẫu</p>
                                <p className="font-bold text-slate-700 text-base leading-snug">{word.example.target}</p>
                                {word.example.viet_pronunciation && (
                                    <p className="text-xs text-slate-400 italic font-medium mt-0.5">{word.example.viet_pronunciation}</p>
                                )}
                            </div>

                            {/* Audio Actions Row */}
                            <div className="flex gap-2 shrink-0">
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'fast', word.example.target)}
                                    className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg border-2 border-sky-100 text-sky-500 text-[10px] font-bold hover:bg-sky-50 active:scale-95 transition-all"
                                >
                                    <Volume2 className="w-3 h-3" /> Máy
                                </button>
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'ai', word.example.target)}
                                    className="flex items-center gap-1 px-2 py-1 bg-sky-500 rounded-lg border-2 border-sky-600 text-white text-[10px] font-bold hover:bg-sky-600 active:scale-95 transition-all shadow-sm"
                                    disabled={aiLoading}
                                >
                                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                                    AI
                                </button>
                            </div>
                            
                            <div className="w-full h-0.5 bg-sky-200/50 shrink-0"></div>
                            
                            <p className="text-sm text-slate-600 font-semibold leading-relaxed italic pb-1">
                                "{word.example.vietnamese}"
                            </p>
                        </div>
                     </div>
                 )}
             </div>
        </div>

      </div>
    </div>
  );
};
