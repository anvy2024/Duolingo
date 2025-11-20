import React, { useState } from 'react';
import { VocabularyWord } from '../types';
import { Volume2, CheckCircle, Circle, Zap, Sparkles, Loader2, Heart, Radio } from 'lucide-react';

interface FlashcardProps {
  word: VocabularyWord;
  speakFast: (text: string, onEnd?: () => void) => void;
  speakAI: (text: string) => void;
  aiLoading: boolean;
  onToggleMastered?: (id: string, currentStatus: boolean) => void;
  onToggleFavorite?: (id: string, currentStatus: boolean) => void;
  isViewMode?: boolean;
  backActionLabel?: string; // Optional label for buttons on back
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, speakFast, speakAI, aiLoading, onToggleMastered, onToggleFavorite, isViewMode = false }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip state when word changes
  React.useEffect(() => {
    setIsFlipped(false);
  }, [word.id]);

  const handleCardClick = () => {
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
        onToggleMastered(word.id, !!word.mastered);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleFavorite) {
          onToggleFavorite(word.id, !!word.isFavorite);
      }
  };

  const isPhraseMode = word.target.length > 50 || (word.target === word.example.target);
  const displayTarget = word.target;

  // Dynamic Font Sizing
  const getFontSize = (text: string) => {
      if (text.length > 100) return 'text-lg leading-relaxed text-left px-4';
      if (text.length > 50) return 'text-2xl leading-tight';
      if (text.length > 20) return 'text-3xl';
      return 'text-4xl md:text-5xl';
  };

  return (
    <div className={`w-full max-w-xs aspect-[3/4] ${isViewMode ? 'max-h-[500px]' : 'max-h-[450px]'} perspective-1000 mx-auto my-4 lg:my-0 cursor-pointer group`} onClick={handleCardClick}>
      <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* FRONT SIDE */}
        <div className={`absolute w-full h-full bg-white rounded-3xl border-2 border-slate-200 border-b-[6px] backface-hidden flex flex-col items-center justify-between p-6 shadow-sm ${word.mastered ? 'border-green-400 bg-green-50' : ''}`}>
          
          <div className="w-full flex justify-between items-start">
             <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-xl border-b-2 ${
                 word.category === 'common-verbs' ? 'bg-sky-100 text-sky-600 border-sky-200' : 
                 word.category === 'irregular-verbs' ? 'bg-purple-100 text-purple-600 border-purple-200' : 
                 'bg-slate-100 text-slate-500 border-slate-200'
             }`}>
                {isPhraseMode ? 'Câu / Đoạn' : (word.category === 'common-verbs' ? 'Động từ' : word.category === 'irregular-verbs' ? 'Bất quy tắc' : 'Từ vựng')}
             </span>
             
             <div className="flex gap-2">
                {word.isFavorite && (
                    <div className="text-rose-500">
                        <Heart className="w-6 h-6 fill-rose-500" />
                    </div>
                )}
             </div>
          </div>

          <div className="flex flex-col items-center justify-center w-full text-center flex-1 overflow-hidden">
            <div className={`${getFontSize(displayTarget)} font-black text-slate-700 mb-8 break-words w-full tracking-tight overflow-y-auto max-h-[60%]`}>
                {displayTarget}
            </div>
            
            {/* AUDIO BUTTONS ROW FRONT */}
            <div className="flex items-center justify-center gap-4 w-full shrink-0">
                <button 
                    onClick={(e) => handleAudioClick(e, 'fast', displayTarget)}
                    className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 border-2 border-slate-200 border-b-4 hover:bg-slate-200 hover:text-sky-500 hover:border-sky-300 active:border-b-0 active:translate-y-1 transition-all"
                    title="Đọc nhanh (Google)"
                >
                    <Zap className="w-6 h-6" />
                </button>

                <button 
                    onClick={(e) => handleAudioClick(e, 'ai', displayTarget)}
                    className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-sky-500 text-white border-sky-600 border-b-4 hover:bg-sky-400 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-sky-200"
                    disabled={aiLoading}
                    title="Đọc chuẩn (AI)"
                >
                    {aiLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                        <Radio className="w-8 h-8" />
                    )}
                </button>
            </div>
          </div>

          <div className="w-full text-center pt-2 shrink-0">
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Chạm để lật</p>
          </div>
        </div>

        {/* BACK SIDE */}
        <div className={`absolute w-full h-full bg-white rounded-3xl border-2 border-slate-200 border-b-[6px] backface-hidden rotate-y-180 flex flex-col p-5 overflow-y-auto ${word.mastered ? 'border-green-400' : ''}`}>
             <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3 mb-3 shrink-0">
                 <div className="flex-1">
                     <h3 className="text-xl font-black text-slate-700 line-clamp-3">{word.vietnamese}</h3>
                 </div>
                 {/* Audio Buttons on Back Side (Small version) */}
                 <div className="flex gap-2 shrink-0 ml-2">
                    <button 
                        onClick={(e) => handleAudioClick(e, 'fast', displayTarget)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-sky-500 transition-colors"
                    >
                        <Zap className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={(e) => handleAudioClick(e, 'ai', displayTarget)}
                        disabled={aiLoading}
                        className="p-2 rounded-xl bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors disabled:opacity-50"
                    >
                        {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
                    </button>
                 </div>
             </div>

             <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                 <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-2">Phát âm</p>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-400 w-8">IPA</span>
                             <span className="font-mono text-slate-600 text-sm bg-white px-2 py-1 rounded border border-slate-200">{word.ipa}</span>
                        </div>
                        {word.viet_pronunciation && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 w-8">Bồi</span>
                                <span className="italic text-sky-600 text-base font-bold">{word.viet_pronunciation}</span>
                            </div>
                        )}
                    </div>
                 </div>

                 {/* Only show example if it's NOT a phrase mode (where target == example) */}
                 {!isPhraseMode && (
                     <div>
                        <p className="text-xs text-slate-400 uppercase font-bold mb-2">Ví dụ mẫu</p>
                        <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-100 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-slate-700 text-lg leading-snug">{word.example.target}</p>
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'fast', word.example.target)}
                                    className="bg-white text-sky-500 p-2 rounded-xl border-b-2 border-sky-100 active:border-b-0 active:translate-y-0.5 shrink-0 transition-all hover:bg-sky-50"
                                >
                                    <Volume2 className="w-5 h-5" />
                                </button>
                            </div>
                            {word.example.viet_pronunciation && (
                                <p className="text-sm text-slate-500 italic font-medium">{word.example.viet_pronunciation}</p>
                            )}
                            <div className="w-full h-0.5 bg-sky-200/50"></div>
                            <p className="text-sm text-slate-600 font-medium">{word.example.vietnamese}</p>
                        </div>
                     </div>
                 )}
             </div>
             
             <div className="mt-4 pt-2 flex justify-between items-center gap-3 shrink-0">
                 
                 {onToggleFavorite && (
                     <button
                        onClick={handleFavoriteClick}
                        className={`p-3 rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all ${
                            word.isFavorite
                            ? 'bg-rose-500 text-white border-rose-600'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                     >
                         <Heart className={`w-6 h-6 ${word.isFavorite ? 'fill-white' : ''}`} />
                     </button>
                 )}
                 
                 {onToggleMastered && (
                    <button 
                        onClick={handleMasterClick}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold uppercase tracking-wide transition-all flex-1 justify-center border-b-4 active:border-b-0 active:translate-y-1 ${
                            word.mastered 
                            ? 'bg-green-500 text-white border-green-600' 
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                    >
                        {word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        {word.mastered ? 'Đã thuộc' : 'Đánh dấu'}
                    </button>
                 )}
             </div>
        </div>

      </div>
    </div>
  );
};