import React, { useState, useEffect } from 'react';
import { RotateCw, GraduationCap, Sparkles, Library, Zap, AlertCircle, Heart, CheckCircle, Settings, ExternalLink, Newspaper, Book, Maximize, Minimize, Share, Plus, Minus, Volume2, X } from 'lucide-react';
import { GenerationTopic } from '../services/geminiService';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants/translations';

interface DashboardProps {
  totalLearned: number;
  masteredCount: number;
  favoriteCount: number;
  currentLang: Language;
  onStartNew: (topic: GenerationTopic, count: number, autoFetchAudio: boolean, autoFetchExampleAudio: boolean) => void;
  onStartReview: () => void;
  onStartFavorites: () => void;
  onStartMastered: () => void;
  onViewList: () => void;
  onOpenSettings: () => void;
  onOpenNews: () => void;
  onSwitchLang: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    totalLearned, masteredCount, favoriteCount, currentLang,
    onStartNew, onStartReview, onStartFavorites, onStartMastered, onViewList, onOpenSettings, onOpenNews, onSwitchLang 
}) => {
  const t = TRANSLATIONS[currentLang];
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  
  // Config Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<GenerationTopic | null>(null);
  const [wordCount, setWordCount] = useState(10);
  const [autoFetchAudio, setAutoFetchAudio] = useState(false);
  const [autoFetchExampleAudio, setAutoFetchExampleAudio] = useState(false);

  let langName = 'Français';
  let langColor = 'bg-blue-500';
  if (currentLang === 'en') { langName = 'English'; langColor = 'bg-blue-600'; }
  else if (currentLang === 'zh') { langName = '中文'; langColor = 'bg-red-500'; }
  else if (currentLang === 'es') { langName = 'Español'; langColor = 'bg-yellow-500'; }

  useEffect(() => {
      const handleFsChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);

      // Check iOS and Standalone
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(ios);
      
      // Check if running in standalone mode (PWA)
      const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!isInStandalone);

      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullScreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((e) => {
              console.log(e);
          });
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
  };

  const handleTopicClick = (topic: GenerationTopic) => {
      setSelectedTopic(topic);
      setIsConfigModalOpen(true);
  };

  const handleStartConfig = () => {
      if (selectedTopic) {
          onStartNew(selectedTopic, wordCount, autoFetchAudio, autoFetchExampleAudio);
          setIsConfigModalOpen(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-y-auto custom-scrollbar">
        {/* Top Bar - Added pt-safe for iPhone Notch support */}
        <div className="flex justify-between items-center p-4 sticky top-0 bg-gray-100/95 backdrop-blur-sm z-10 border-b-2 border-slate-200 pt-[env(safe-area-inset-top,20px)]">
             <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={onSwitchLang}>
                <div className={`p-2 rounded-xl ${langColor}`}>
                    <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-extrabold text-slate-700 tracking-tight">
                        {langName}
                    </h1>
                    <span className="text-xs font-bold text-slate-400 uppercase">{t.changeLang}</span>
                </div>
             </div>
             
            <div className="flex items-center gap-2">
                <button 
                    onClick={toggleFullScreen}
                    className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-colors hidden sm:block" 
                    title="Full Screen"
                >
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </button>

                <button 
                    onClick={onOpenSettings}
                    className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-colors"
                >
                    <Settings className="w-6 h-6" />
                </button>
            </div>
        </div>

        <div className="flex flex-col flex-1 p-5 space-y-8 max-w-md mx-auto w-full pb-12">
            
            {/* Hero Stats Card */}
            <div className="w-full space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div 
                        onClick={onViewList}
                        className="bg-white rounded-3xl border-2 border-slate-200 border-b-4 p-4 flex flex-col justify-between active:border-b-2 active:translate-y-[2px] transition-all cursor-pointer hover:bg-slate-50 group col-span-2"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <Library className="w-8 h-8 text-slate-300 group-hover:text-sky-500 transition-colors" />
                            <span className="bg-sky-100 text-sky-600 text-xs font-black px-2 py-1 rounded-lg uppercase">{t.dictionary}</span>
                        </div>
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-700 group-hover:text-sky-500 transition-colors">{totalLearned}</h2>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">{t.totalWords}</p>
                        </div>
                    </div>

                    <button 
                        onClick={onStartMastered}
                        disabled={masteredCount === 0}
                        className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col items-center justify-center active:border-b-2 active:translate-y-[2px] transition-all ${
                            masteredCount === 0 
                            ? 'bg-white border-slate-200 text-slate-300 cursor-not-allowed' 
                            : 'bg-white border-green-200 text-green-500 hover:bg-green-50 cursor-pointer'
                        }`}
                    >
                        <CheckCircle className={`w-8 h-8 mb-2 ${masteredCount > 0 ? 'fill-green-500 text-white' : ''}`} />
                        <span className="text-xl font-extrabold">{masteredCount}</span>
                        <span className="text-[10px] font-black uppercase opacity-60">{t.mastered}</span>
                    </button>

                    <button 
                        onClick={onStartFavorites}
                        disabled={favoriteCount === 0}
                        className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col items-center justify-center active:border-b-2 active:translate-y-[2px] transition-all ${
                            favoriteCount === 0 
                            ? 'bg-white border-slate-200 text-slate-300 cursor-not-allowed' 
                            : 'bg-white border-rose-200 text-rose-500 hover:bg-rose-50 cursor-pointer'
                        }`}
                    >
                        <Heart className={`w-8 h-8 mb-2 ${favoriteCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span className="text-xl font-extrabold">{favoriteCount}</span>
                        <span className="text-[10px] font-black uppercase opacity-60">{t.favorites}</span>
                    </button>
                </div>
            </div>

            {/* Learning Section */}
            <div className="space-y-4">
                <h3 className="font-extrabold text-slate-700 text-lg px-1 uppercase tracking-wider">{t.newLesson}</h3>
                
                <button 
                    onClick={() => handleTopicClick('general')}
                    className="w-full bg-green-500 hover:bg-green-400 text-white border-green-600 border-b-4 active:border-b-0 active:mt-1 rounded-2xl p-4 flex items-center gap-4 transition-all group"
                >
                    <div className="bg-white/20 p-3 rounded-xl">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="text-left flex-1">
                        <div className="font-extrabold text-lg">{t.generalTopic}</div>
                        <div className="text-green-100 text-sm font-medium">{t.randomTopic}</div>
                    </div>
                </button>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleTopicClick('common-verbs')}
                        className="bg-sky-500 hover:bg-sky-400 text-white border-sky-600 border-b-4 active:border-b-0 active:mt-1 rounded-2xl p-4 flex flex-col items-center text-center gap-2 transition-all"
                    >
                         <div className="bg-white/20 p-2 rounded-xl">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div className="font-extrabold text-sm whitespace-pre-line">{t.commonVerbs}</div>
                    </button>

                    <button 
                        onClick={() => handleTopicClick('irregular-verbs')}
                        className="bg-purple-500 hover:bg-purple-400 text-white border-purple-600 border-b-4 active:border-b-0 active:mt-1 rounded-2xl p-4 flex flex-col items-center text-center gap-2 transition-all"
                    >
                        <div className="bg-white/20 p-2 rounded-xl">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="font-extrabold text-sm whitespace-pre-line">{t.irregularVerbs}</div>
                    </button>
                </div>
            </div>
            
            {/* Reading Section */}
            <div className="space-y-4">
                <h3 className="font-extrabold text-slate-700 text-lg px-1 uppercase tracking-wider">{t.reading}</h3>
                <button 
                    onClick={onOpenNews}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 text-white border-indigo-600 border-b-4 active:border-b-0 active:mt-1 rounded-2xl p-4 flex items-center gap-4 transition-all"
                >
                    <div className="bg-white/20 p-3 rounded-xl">
                        <Newspaper className="w-6 h-6" />
                    </div>
                    <div className="text-left flex-1">
                        <div className="font-extrabold text-lg">{t.canadaNews}</div>
                        <div className="text-indigo-100 text-sm font-medium">{t.latestNews}</div>
                    </div>
                </button>
            </div>

            {/* Review Section */}
            <div className="space-y-4">
                 <h3 className="font-extrabold text-slate-700 text-lg px-1 uppercase tracking-wider">{t.practice}</h3>
                 
                 <div className="grid grid-cols-1 gap-4">
                    <button 
                        onClick={onStartReview}
                        disabled={totalLearned === 0}
                        className={`w-full border-b-4 rounded-2xl p-4 flex items-center gap-4 transition-all active:border-b-0 active:mt-1 ${
                            totalLearned === 0 
                                ? 'bg-white border-slate-200 text-slate-300 cursor-not-allowed' 
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <div className={`p-3 rounded-xl ${totalLearned > 0 ? 'bg-blue-100 text-blue-500' : 'bg-slate-100 text-slate-300'}`}>
                            <RotateCw className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <div className="font-extrabold text-lg">{t.review}</div>
                            <div className="text-slate-400 text-sm font-medium">{t.reviewDesc}</div>
                        </div>
                    </button>
                    
                    {/* Dictionary Button (Explicit) */}
                    <button 
                        onClick={onViewList}
                        className="w-full bg-orange-500 hover:bg-orange-400 text-white border-orange-600 border-b-4 active:border-b-0 active:mt-1 rounded-2xl p-4 flex items-center gap-4 transition-all"
                    >
                         <div className="bg-white/20 p-3 rounded-xl">
                            <Book className="w-6 h-6" />
                        </div>
                         <div className="text-left flex-1">
                            <div className="font-extrabold text-lg">{t.dictionary} & {t.games}</div>
                            <div className="text-orange-100 text-sm font-medium">{t.totalWords}: {totalLearned}</div>
                        </div>
                    </button>
                 </div>
            </div>

            {/* Footer / Credits */}
            <div className="mt-8 pt-8 border-t-2 border-slate-200 text-center">
                <p className="text-slate-400 text-xs font-bold uppercase mb-2">{t.devBy}</p>
                <a 
                    href="https://www.facebook.com/hanaminhtranphotography" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-500 font-extrabold hover:text-indigo-600 hover:underline transition-colors bg-indigo-50 px-4 py-2 rounded-xl"
                >
                    Hana Minh Tran
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>

        {/* CONFIG MODAL */}
        {isConfigModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-2 border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-700">Lesson Setup</h3>
                        <button onClick={() => setIsConfigModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Quantity Input */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <label className="block text-xs font-bold text-slate-400 uppercase mb-3">
                                 Number of words to generate
                             </label>
                             <div className="flex items-center gap-4">
                                 <button 
                                    onClick={() => setWordCount(Math.max(1, wordCount - 1))}
                                    className="p-3 bg-white rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95"
                                 >
                                     <Minus className="w-5 h-5" />
                                 </button>
                                 
                                 <div className="flex-1 text-center">
                                     <span className="text-3xl font-black text-slate-700">{wordCount}</span>
                                 </div>

                                 <button 
                                    onClick={() => setWordCount(Math.min(20, wordCount + 1))}
                                    className="p-3 bg-white rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 active:scale-95"
                                 >
                                     <Plus className="w-5 h-5" />
                                 </button>
                             </div>
                        </div>

                        {/* Auto Audio Word Toggle */}
                        <div 
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer"
                            onClick={() => setAutoFetchAudio(!autoFetchAudio)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${autoFetchAudio ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <Volume2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">Auto-fetch Word Audio</p>
                                    <p className="text-xs text-slate-400 font-bold">Save time later</p>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${autoFetchAudio ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`}>
                                {autoFetchAudio && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                        </div>

                        {/* Auto Audio Example Toggle */}
                        <div 
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer"
                            onClick={() => setAutoFetchExampleAudio(!autoFetchExampleAudio)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${autoFetchExampleAudio ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">Auto-fetch Example Audio</p>
                                    <p className="text-xs text-slate-400 font-bold">Sentences (Takes longer)</p>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${autoFetchExampleAudio ? 'bg-purple-500 border-purple-500' : 'bg-white border-slate-300'}`}>
                                {autoFetchExampleAudio && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                        </div>

                        <button 
                            onClick={handleStartConfig}
                            className="w-full py-4 bg-green-500 text-white rounded-2xl font-extrabold uppercase tracking-wide border-green-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-5 h-5" />
                            Start Generating
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};