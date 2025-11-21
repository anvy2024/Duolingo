
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
      if (text.length > 100) return 'text-lg leading-relaxed text-left px-4';
      if (text.length > 50) return 'text-xl leading-tight';
      if (text.length > 20) return 'text-2xl';
      return 'text-4xl';
  };

  // Critical style for iOS 3D transforms
  const backfaceStyle: React.CSSProperties = {
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  return (
    // Changed aspect ratio to 4/5 for mobile (shorter) and kept 3/5 for desktop/tablets
    <div className={`w-full max-w-sm aspect-[4/5] md:aspect-[3/5] ${isViewMode ? 'max-h-[55vh]' : 'max-h-[500px]'} perspective-1000 mx-auto my-2 cursor-pointer group select-none`} onClick={handleCardClick}>
      <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* FRONT SIDE */}
        <div 
            className={`absolute w-full h-full bg-white rounded-[2rem] border-2 border-slate-200 border-b-[8px] flex flex-col items-center justify-between p-5 shadow-xl ${word.mastered ? 'border-green-400 bg-green-50/30' : ''}`}
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
                        className={`p-2 rounded-full transition-all ${
                            word.isFavorite
                            ? 'bg-rose-100 text-rose-500 shadow-sm'
                            : 'bg-slate-100 text-slate-300 hover:bg-rose-50 hover:text-rose-400'
                        }`}
                    >
                        <Heart className={`w-5 h-5 ${word.isFavorite ? 'fill-rose-500' : ''}`} />
                    </button>
                )}
                
                {onToggleMastered && (
                   <button 
                       onClick={handleMasterClick}
                       className={`p-2 rounded-full transition-all ${
                           word.mastered 
                           ? 'bg-green-100 text-green-500 shadow-sm' 
                           : 'bg-slate-100 text-slate-300 hover:bg-green-50 hover:text-green-400'
                       }`}
                   >
                       {word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                   </button>
                )}
             </div>
          </div>

          {/* Main Word Display */}
          <div className="flex flex-col items-center justify-center w-full text-center flex-1 overflow-hidden py-2">
            <div className={`${getFontSize(displayTarget)} font-black text-slate-700 mb-6 break-words w-full tracking-tight overflow-y-auto max-h-[60%]`}>
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

          {/* EXAMPLE SENTENCE AREA (Shortened) */}
          <div className="w-full mb-4 shrink-0 z-10 text-center px-2">
               {!isPhraseMode && (
                   <div className="flex flex-col items-center gap-1 group/example" onClick={(e) => e.stopPropagation()}>
                       <p className="text-sm md:text-base leading-snug font-medium text-slate-600 italic line-clamp-2">
                           "{word.example.target}"
                       </p>
                       <div className="flex gap-3 mt-1">
                            <button 
                                onClick={(e) => handleAudioClick(e, 'fast', word.example.target)}
                                className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                            >
                                <Volume2 className="w-4 h-4" />
                            </button>
                             <button 
                                onClick={(e) => handleAudioClick(e, 'ai', word.example.target)}
                                className="p-1.5 rounded-full bg-sky-100 text-sky-500 hover:bg-sky-200 transition-colors"
                                disabled={aiLoading}
                            >
                                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                            </button>
                       </div>
                   </div>
               )}
          </div>
          {/* Removed Footer Text "Cham de lat" to save space and fix visual glitch */}
        </div>

        {/* BACK SIDE */}
        <div 
            className={`absolute w-full h-full bg-white rounded-[2rem] border-2 border-slate-200 border-b-[8px] rotate-y-180 flex flex-col p-5 overflow-hidden ${word.mastered ? 'border-green-400' : ''}`}
            style={backfaceStyle}
        >
             
             {/* Header: Vietnamese Meaning - FIXED LAYOUT */}
             <div className="flex flex-row justify-between items-start border-b-2 border-slate-100 pb-3 mb-3 shrink-0 w-full">
                 <div className="flex-1 pr-2 min-w-0">
                     <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Nghĩa tiếng Việt</p>
                     <h3 className="text-xl md:text-2xl font-black text-slate-700 leading-tight break-words">{word.vietnamese}</h3>
                 </div>
                 {/* Fixed Action Container - uses shrink-0 to stay on right */}
                 <div className="shrink-0">
                    <button 
                        onClick={(e) => handleAudioClick(e, 'fast', displayTarget)}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:text-sky-500 transition-colors"
                    >
                        <Zap className="w-5 h-5" />
                    </button>
                 </div>
             </div>

             {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                 
                 {/* Pronunciation Block */}
                 <div className="bg-slate-50 p-3 rounded-xl border-2 border-slate-100 shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                         <span className="text-[10px] font-bold text-white bg-slate-400 px-1.5 py-0.5 rounded uppercase">IPA</span>
                         <span className="font-mono text-slate-600 text-base font-medium tracking-wide break-all">{word.ipa}</span>
                    </div>
                    {word.viet_pronunciation && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white bg-sky-400 px-1.5 py-0.5 rounded uppercase">Bồi</span>
                            <span className="italic text-sky-600 text-lg font-bold break-words">{word.viet_pronunciation}</span>
                        </div>
                    )}
                 </div>

                 {/* Example Block - Redesigned */}
                 {!isPhraseMode && (
                     <div className="flex-1">
                        <div className="p-4 rounded-xl bg-sky-50 border-2 border-sky-100 space-y-2">
                            <p className="text-[10px] text-sky-500 uppercase font-bold">Ví dụ mẫu</p>
                            
                            <div>
                                <p className="font-bold text-slate-700 text-lg leading-snug">{word.example.target}</p>
                                {word.example.viet_pronunciation && (
                                    <p className="text-xs text-slate-500 italic font-medium mt-0.5">{word.example.viet_pronunciation}</p>
                                )}
                            </div>

                            {/* Audio Actions Row for Example */}
                            <div className="flex gap-2 pt-1">
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'fast', word.example.target)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg border-2 border-sky-100 text-sky-500 text-[10px] font-bold hover:bg-sky-50 active:scale-95 transition-all"
                                >
                                    <Volume2 className="w-3 h-3" /> Máy
                                </button>
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'ai', word.example.target)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-sky-500 rounded-lg border-2 border-sky-600 text-white text-[10px] font-bold hover:bg-sky-600 active:scale-95 transition-all shadow-sm"
                                    disabled={aiLoading}
                                >
                                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                                    AI
                                </button>
                            </div>
                            
                            <div className="w-full h-0.5 bg-sky-200/50 my-1"></div>
                            
                            <p className="text-sm text-slate-600 font-semibold leading-relaxed italic">
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
