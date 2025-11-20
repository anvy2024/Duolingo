
import React from 'react';
import { VocabularyWord, Language } from '../types';
import { Zap, Sparkles, ArrowRight, Volume2, Home, Heart, CheckCircle, Circle } from 'lucide-react';
import { TRANSLATIONS } from '../constants/translations';

interface StudyListProps {
  words: VocabularyWord[];
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
    words, onComplete, onBackToHome, speakFast, speakAI, aiLoading, currentLang,
    onToggleMastered, onToggleFavorite
}) => {
  const t = TRANSLATIONS[currentLang];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full p-4">
        
      <div className="flex justify-between mb-4 px-1">
        <button 
            onClick={onBackToHome}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-sm transition-colors"
        >
            <Home className="w-4 h-4" /> {t.backHome}
        </button>
      </div>
      
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 mb-4 text-center shadow-sm">
            <h2 className="text-2xl font-black text-slate-700 mb-2">{t.newVocab}</h2>
            <p className="text-slate-500 font-medium">{t.introText}</p>
            
            <button 
                onClick={onComplete}
                className="mt-4 w-full bg-green-500 text-white border-green-600 border-b-4 active:border-b-0 active:translate-y-1 px-6 py-3 rounded-xl text-base font-extrabold uppercase tracking-wide hover:bg-green-400 transition-all flex items-center justify-center gap-2"
            >
                {t.startPractice}
                <ArrowRight className="w-5 h-5" />
            </button>
      </div>

      <div className="space-y-4 pb-24">
        {words.map((word, idx) => (
            <div key={word.id} className="bg-white rounded-2xl p-5 border-2 border-slate-200 border-b-4 flex flex-col gap-4 relative group">
                <div className="flex justify-between items-start">
                    <div className="flex-1 mr-2">
                        <div className="flex items-center gap-3">
                            <span className="bg-slate-100 text-slate-400 font-extrabold px-2 py-1 rounded-lg text-xs">#{idx + 1}</span>
                            <h3 className="text-2xl font-black text-slate-700">{word.target}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-sm font-mono text-slate-500 border border-slate-200 px-1.5 rounded">{word.ipa}</span>
                            {word.viet_pronunciation && (
                                <span className="text-sm text-sky-500 font-bold italic">({word.viet_pronunciation})</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
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
                    </div>
                </div>
                
                <div className="border-t-2 border-slate-100 pt-3">
                    <p className="font-extrabold text-lg text-slate-600 mb-3">{word.vietnamese}</p>
                    
                    <div className="bg-sky-50 rounded-xl p-4 border-2 border-sky-100">
                        <div className="flex justify-between items-start gap-2">
                            <p className="text-slate-700 font-bold text-base leading-relaxed">{word.example.target}</p>
                            <button 
                                onClick={() => speakFast(word.example.target)} 
                                className="text-sky-500 hover:text-sky-400 shrink-0 active:scale-90 transition-transform"
                            >
                                <Volume2 className="w-5 h-5" />
                            </button>
                        </div>
                        {word.example.viet_pronunciation && (
                            <p className="text-slate-500 italic text-xs font-medium mt-1">{word.example.viet_pronunciation}</p>
                        )}
                        <p className="text-slate-500 font-medium mt-2">{word.example.vietnamese}</p>
                    </div>
                </div>

                {/* Action Bar */}
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
            </div>
        ))}
      </div>
    </div>
  );
};
