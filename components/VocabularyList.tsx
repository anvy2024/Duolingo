
import React, { useState } from 'react';
import { VocabularyWord, Language } from '../types';
import { Zap, Sparkles, Search, ArrowLeft, Trash2, X, Heart, CheckCircle, Plus, Save, Loader2, Radio } from 'lucide-react';
import { Flashcard } from './Flashcard';
import { generateSingleWordDetails } from '../services/geminiService';
import { TRANSLATIONS } from '../constants/translations';

interface VocabularyListProps {
  words: VocabularyWord[];
  currentLang: Language;
  onBack: () => void;
  speakFast: (text: string) => void;
  speakAI: (text: string) => void;
  aiLoading: boolean;
  onDelete: (id: string) => void;
  onToggleMastered: (id: string, status: boolean) => void;
  onToggleFavorite: (id: string, status: boolean) => void;
  playbackSpeed: number;
  onToggleSpeed: () => void;
  onAddWord: (word: VocabularyWord) => void;
}

export const VocabularyList: React.FC<VocabularyListProps> = ({ 
    words, currentLang, onBack, speakFast, speakAI, aiLoading, onDelete, 
    onToggleMastered, onToggleFavorite, playbackSpeed, onToggleSpeed, onAddWord 
}) => {
  const t = TRANSLATIONS[currentLang];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [newTarget, setNewTarget] = useState('');
  const [newVietnamese, setNewVietnamese] = useState('');
  const [newIpa, setNewIpa] = useState('');
  const [newVietPronun, setNewVietPronun] = useState('');
  const [newExTarget, setNewExTarget] = useState('');
  const [newExViet, setNewExViet] = useState('');
  const [newExVietPronun, setNewExVietPronun] = useState('');

  const filteredWords = words.filter(word => 
    word.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
    word.vietnamese.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t.confirmDelete)) {
        onDelete(id);
        if (selectedWord?.id === id) {
            setSelectedWord(null);
        }
    }
  };

  const handleCardToggleMastered = (id: string, status: boolean) => {
    onToggleMastered(id, status);
    if (selectedWord && selectedWord.id === id) {
        setSelectedWord({ ...selectedWord, mastered: !status });
    }
  };

  const handleCardToggleFavorite = (id: string, status: boolean) => {
      onToggleFavorite(id, status);
      if (selectedWord && selectedWord.id === id) {
          setSelectedWord({ ...selectedWord, isFavorite: !status });
      }
  }

  const handleListFavoriteClick = (e: React.MouseEvent, id: string, status: boolean) => {
      e.stopPropagation();
      onToggleFavorite(id, status);
  }

  const handleAutoFill = async () => {
    if (!newTarget.trim()) return;
    setIsGenerating(true);
    try {
        const details = await generateSingleWordDetails(newTarget, currentLang);
        setNewTarget(details.target);
        setNewVietnamese(details.vietnamese);
        setNewIpa(details.ipa);
        setNewVietPronun(details.viet_pronunciation);
        setNewExTarget(details.example.target);
        setNewExViet(details.example.vietnamese);
        setNewExVietPronun(details.example.viet_pronunciation);
    } catch (err) {
        alert("Error auto-filling. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSaveWord = () => {
      if (!newTarget.trim() || !newVietnamese.trim()) {
          alert("Please enter word and meaning.");
          return;
      }

      const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

      const newWord: VocabularyWord = {
          id: generateId(),
          target: newTarget.trim(),
          vietnamese: newVietnamese.trim(),
          ipa: newIpa || '',
          viet_pronunciation: newVietPronun || '',
          example: {
              target: newExTarget || newTarget.trim(),
              vietnamese: newExViet || newVietnamese.trim(),
              viet_pronunciation: newExVietPronun || ''
          },
          learnedAt: Date.now(),
          category: 'general',
          mastered: false,
          isFavorite: false
      };

      onAddWord(newWord);
      setIsAddModalOpen(false);
      
      setNewTarget('');
      setNewVietnamese('');
      setNewIpa('');
      setNewVietPronun('');
      setNewExTarget('');
      setNewExViet('');
      setNewExVietPronun('');
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full bg-gray-100 relative">
      <div className="p-4 sticky top-0 z-10 bg-gray-100/95 backdrop-blur-sm border-b-2 border-slate-200">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-extrabold text-slate-700">{t.dictionary}</h2>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center p-2 bg-green-500 text-white rounded-xl border-green-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>
        </div>
        
        <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
                type="text" 
                placeholder={t.search + "..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none transition-all font-bold placeholder:text-slate-400"
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 custom-scrollbar">
        {filteredWords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Search className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-bold text-lg">{t.notFound}</p>
            </div>
        ) : (
            filteredWords.map((word) => (
                <div 
                    key={word.id} 
                    onClick={() => setSelectedWord(word)}
                    className="bg-white rounded-2xl p-4 border-2 border-slate-200 border-b-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] transition-all group"
                >
                    <div className="flex-1 min-w-0 mr-2">
                        <h3 className="font-black text-lg text-slate-700 truncate group-hover:text-sky-500 transition-colors">{word.target}</h3>
                        <p className="text-slate-500 font-medium text-sm truncate">{word.vietnamese}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                speakFast(word.target);
                            }}
                            className="p-2 rounded-xl text-slate-400 bg-slate-100 border border-slate-200 hover:text-sky-500 hover:border-sky-300 transition-colors"
                            title="Google TTS"
                        >
                            <Zap className="w-4 h-4" />
                        </button>
                        
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                speakAI(word.target);
                            }}
                            disabled={aiLoading}
                            className="p-2 rounded-xl text-white bg-sky-500 border-sky-600 border-b-2 active:border-b-0 active:translate-y-0.5 hover:bg-sky-400 transition-all disabled:opacity-50"
                            title="AI TTS"
                        >
                             {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                        </button>

                         <button 
                            onClick={(e) => handleListFavoriteClick(e, word.id, !!word.isFavorite)}
                            className={`p-2 rounded-xl transition-colors ${word.isFavorite ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:text-rose-400'}`}
                         >
                            <Heart className={`w-5 h-5 ${word.isFavorite ? 'fill-rose-500' : ''}`} />
                        </button>
                        
                        {word.mastered && <CheckCircle className="w-5 h-5 text-green-500 fill-green-100" />}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* ADD NEW WORD MODAL */}
      {isAddModalOpen && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border-2 border-slate-200">
                <div className="p-4 border-b-2 border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
                    <h3 className="text-xl font-extrabold text-slate-700">{t.addWord}</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-extrabold text-slate-400 mb-2 uppercase">Word</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-bold text-lg placeholder:text-slate-300"
                                placeholder={currentLang === 'fr' ? "Ex: Chat" : "Ex: Cat"}
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                            />
                            <button 
                                onClick={handleAutoFill}
                                disabled={isGenerating || !newTarget}
                                className="px-4 bg-sky-500 text-white rounded-2xl font-bold border-sky-600 border-b-4 active:border-b-0 active:translate-y-1 hover:bg-sky-400 transition-all disabled:opacity-50 disabled:active:border-b-4 disabled:active:translate-y-0"
                            >
                                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-extrabold text-slate-400 mb-2 uppercase">Vietnamese</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-bold"
                                value={newVietnamese}
                                onChange={(e) => setNewVietnamese(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-extrabold text-slate-400 mb-2 uppercase">IPA</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-mono text-sm"
                                value={newIpa}
                                onChange={(e) => setNewIpa(e.target.value)}
                            />
                        </div>
                    </div>

                    {currentLang === 'fr' && (
                        <div>
                            <label className="block text-sm font-extrabold text-slate-400 mb-2 uppercase">Pronunciation (Bồi)</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-medium"
                                value={newVietPronun}
                                onChange={(e) => setNewVietPronun(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 space-y-3">
                        <p className="text-xs font-extrabold text-sky-500 uppercase">{t.example}</p>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 bg-white border-2 border-slate-200 text-slate-700 rounded-xl focus:border-sky-500 outline-none font-medium placeholder:text-slate-300"
                            placeholder="Target..."
                            value={newExTarget}
                            onChange={(e) => setNewExTarget(e.target.value)}
                        />
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl focus:border-sky-500 outline-none text-sm placeholder:text-slate-300"
                            placeholder="Vietnamese..."
                            value={newExViet}
                            onChange={(e) => setNewExViet(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleSaveWord}
                        className="w-full py-4 bg-green-500 text-white rounded-2xl font-extrabold text-lg uppercase tracking-wide shadow-none border-green-600 border-b-4 hover:bg-green-400 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                    >
                        <Save className="w-6 h-6" />
                        {t.save}
                    </button>
                </div>
            </div>
         </div>
      )}

      {selectedWord && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
            onClick={() => setSelectedWord(null)}
        >
            <div className="relative w-full max-w-lg cursor-auto">
                <div onClick={(e) => e.stopPropagation()}>
                    <Flashcard 
                        word={selectedWord} 
                        speakFast={speakFast}
                        speakAI={speakAI}
                        aiLoading={aiLoading}
                        onToggleMastered={handleCardToggleMastered}
                        onToggleFavorite={handleCardToggleFavorite}
                    />
                </div>
                
                <div className="mt-6 flex justify-center gap-4">
                     <button 
                        onClick={(e) => handleDelete(e, selectedWord.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-rose-500 rounded-xl font-bold border-2 border-slate-200 hover:bg-rose-50 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" /> {t.delete}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
