
import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, Language } from '../types';
import { Zap, Sparkles, Search, ArrowLeft, Trash2, X, Heart, CheckCircle, Plus, Save, Loader2, Radio, Gamepad2, Play, HelpCircle, Headphones, Grid, Volume2 } from 'lucide-react';
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

type ViewMode = 'LIST' | 'GAME_MENU' | 'GAME_QUIZ' | 'GAME_AUDIO' | 'GAME_MATCH';

export const VocabularyList: React.FC<VocabularyListProps> = ({ 
    words, currentLang, onBack, speakFast, speakAI, aiLoading, onDelete, 
    onToggleMastered, onToggleFavorite, playbackSpeed, onToggleSpeed, onAddWord 
}) => {
  const t = TRANSLATIONS[currentLang];
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form State
  const [newTarget, setNewTarget] = useState('');
  const [newVietnamese, setNewVietnamese] = useState('');
  const [newIpa, setNewIpa] = useState('');
  const [newVietPronun, setNewVietPronun] = useState('');
  const [newExTarget, setNewExTarget] = useState('');
  const [newExViet, setNewExViet] = useState('');
  const [newExVietPronun, setNewExVietPronun] = useState('');

  // --- GAME STATE ---
  const [score, setScore] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [gameQuestions, setGameQuestions] = useState<any[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  // Matching Game Specifics
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [flippedCards, setFlippedCards] = useState<{id: string, type: 'target' | 'viet'}[]>([]);

  const filteredWords = words.filter(word => 
    word.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
    word.vietnamese.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- GAME LOGIC ---
  const startGame = (mode: ViewMode) => {
      if (words.length < 4) {
          alert(t.needMoreWords);
          return;
      }
      setScore(0);
      setQuestionIndex(0);
      setIsGameOver(false);
      setMatchedPairs([]);
      setFlippedCards([]);
      setSelectedAnswer(null);
      setIsCorrect(null);

      // Prepare Questions
      const shuffled = [...words].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10); // Max 10 questions per round

      if (mode === 'GAME_QUIZ' || mode === 'GAME_AUDIO') {
          const questions = selected.map(word => {
              const distractors = words
                  .filter(w => w.id !== word.id)
                  .sort(() => 0.5 - Math.random())
                  .slice(0, 3);
              
              const options = [word, ...distractors].sort(() => 0.5 - Math.random());
              return {
                  target: word,
                  options: options
              };
          });
          setGameQuestions(questions);
      } else if (mode === 'GAME_MATCH') {
          // Take 4 pairs (8 cards)
          const pairs = shuffled.slice(0, 4);
          let cards: any[] = [];
          pairs.forEach(p => {
              cards.push({ id: p.id, content: p.target, type: 'target', pairId: p.id });
              cards.push({ id: p.id, content: p.vietnamese, type: 'viet', pairId: p.id });
          });
          cards.sort(() => 0.5 - Math.random());
          setGameQuestions(cards);
      }

      setViewMode(mode);
  };

  const handleAnswer = (answerId: string) => {
      if (selectedAnswer) return; // Prevent multiple clicks
      
      const currentQ = gameQuestions[questionIndex];
      const correct = answerId === currentQ.target.id;
      
      setSelectedAnswer(answerId);
      setIsCorrect(correct);
      
      if (correct) {
          setScore(prev => prev + 10);
          // Sound effect
          const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
          audio.volume = 0.5;
          audio.play().catch(() => {});
      } else {
           // Wrong sound
           const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg');
           audio.volume = 0.5;
           audio.play().catch(() => {});
      }

      setTimeout(() => {
          if (questionIndex < gameQuestions.length - 1) {
              setQuestionIndex(prev => prev + 1);
              setSelectedAnswer(null);
              setIsCorrect(null);
          } else {
              setIsGameOver(true);
          }
      }, 1500);
  };

  const handleCardFlip = (card: any, index: number) => {
      if (flippedCards.length === 2 || matchedPairs.includes(card.pairId)) return;
      if (flippedCards.length === 1 && flippedCards[0].type === card.type && flippedCards[0].id === card.id) return; // Click same card

      const newFlipped = [...flippedCards, { ...card, index }];
      setFlippedCards(newFlipped);

      if (newFlipped.length === 2) {
          const match = newFlipped[0].id === newFlipped[1].id;
          if (match) {
              setMatchedPairs(prev => [...prev, newFlipped[0].id]);
              setScore(prev => prev + 20);
              setFlippedCards([]);
              // Check win condition for matching
              if (matchedPairs.length + 1 === 4) { // 4 pairs total
                  setTimeout(() => setIsGameOver(true), 500);
              }
          } else {
              setTimeout(() => setFlippedCards([]), 1000);
          }
      }
  };

  useEffect(() => {
      if (viewMode === 'GAME_AUDIO' && !isGameOver && gameQuestions.length > 0 && !selectedAnswer) {
          // Auto play audio for new question
          const word = gameQuestions[questionIndex].target.target;
          setTimeout(() => speakFast(word), 500);
      }
  }, [questionIndex, viewMode, isGameOver]);


  // --- EXISTING HANDLERS ---

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
      {/* Header */}
      <div className="p-4 sticky top-0 z-10 bg-gray-100/95 backdrop-blur-sm border-b-2 border-slate-200">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <button onClick={() => viewMode === 'LIST' ? onBack() : setViewMode('LIST')} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-extrabold text-slate-700">
                        {viewMode === 'LIST' ? t.dictionary : t.playGames}
                    </h2>
                </div>
            </div>
            
            {viewMode === 'LIST' && (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setViewMode('GAME_MENU')}
                        className="flex items-center justify-center p-2 bg-orange-500 text-white rounded-xl border-orange-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all animate-pulse"
                        title={t.games}
                    >
                        <Gamepad2 className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center justify-center p-2 bg-green-500 text-white rounded-xl border-green-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
        
        {viewMode === 'LIST' && (
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
        )}
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 custom-scrollbar">
        
        {/* 1. LIST VIEW */}
        {viewMode === 'LIST' && (
            <>
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
                                >
                                    <Zap className="w-4 h-4" />
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
            </>
        )}

        {/* 2. GAME MENU */}
        {viewMode === 'GAME_MENU' && (
            <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-orange-100 p-6 rounded-3xl text-center border-2 border-orange-200 mb-2">
                     <Gamepad2 className="w-16 h-16 text-orange-500 mx-auto mb-2" />
                     <h3 className="text-xl font-black text-orange-600">{t.playGames}</h3>
                     <p className="text-orange-400 font-bold text-sm">{words.length} {t.totalWords}</p>
                </div>

                <button onClick={() => startGame('GAME_QUIZ')} className="w-full bg-white border-2 border-slate-200 border-b-4 rounded-2xl p-4 flex items-center gap-4 hover:bg-sky-50 active:border-b-2 active:translate-y-[2px] transition-all group">
                    <div className="p-3 bg-sky-100 rounded-xl text-sky-500 group-hover:scale-110 transition-transform">
                        <HelpCircle className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                         <h4 className="text-lg font-extrabold text-slate-700">{t.quizMode}</h4>
                         <p className="text-slate-400 text-sm font-bold">4 Options, 1 Choice</p>
                    </div>
                </button>

                <button onClick={() => startGame('GAME_AUDIO')} className="w-full bg-white border-2 border-slate-200 border-b-4 rounded-2xl p-4 flex items-center gap-4 hover:bg-indigo-50 active:border-b-2 active:translate-y-[2px] transition-all group">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-500 group-hover:scale-110 transition-transform">
                        <Headphones className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                         <h4 className="text-lg font-extrabold text-slate-700">{t.audioMode}</h4>
                         <p className="text-slate-400 text-sm font-bold">{t.listenChoose}</p>
                    </div>
                </button>

                <button onClick={() => startGame('GAME_MATCH')} className="w-full bg-white border-2 border-slate-200 border-b-4 rounded-2xl p-4 flex items-center gap-4 hover:bg-rose-50 active:border-b-2 active:translate-y-[2px] transition-all group">
                    <div className="p-3 bg-rose-100 rounded-xl text-rose-500 group-hover:scale-110 transition-transform">
                        <Grid className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                         <h4 className="text-lg font-extrabold text-slate-700">{t.matchMode}</h4>
                         <p className="text-slate-400 text-sm font-bold">{t.findPair}</p>
                    </div>
                </button>
            </div>
        )}

        {/* 3. GAME OVER SCREEN */}
        {isGameOver && (
             <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in zoom-in duration-300">
                 <div className="mb-6">
                     <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                         <Sparkles className="w-12 h-12 text-yellow-500" />
                     </div>
                 </div>
                 <h2 className="text-3xl font-black text-slate-700 mb-2">{t.gameOver}</h2>
                 <p className="text-slate-400 font-bold text-xl mb-8">{t.score}: <span className="text-green-500">{score}</span></p>
                 
                 <button 
                    onClick={() => setViewMode('GAME_MENU')}
                    className="w-full py-4 bg-sky-500 text-white rounded-2xl font-extrabold border-b-4 border-sky-600 active:border-b-0 active:translate-y-1"
                 >
                     {t.playAgain}
                 </button>
             </div>
        )}

        {/* 4. ACTIVE GAME: QUIZ & AUDIO */}
        {!isGameOver && (viewMode === 'GAME_QUIZ' || viewMode === 'GAME_AUDIO') && gameQuestions.length > 0 && (
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                    <span className="font-black text-slate-400">Q: {questionIndex + 1}/{gameQuestions.length}</span>
                    <span className="font-black text-orange-500 bg-orange-100 px-3 py-1 rounded-lg">{t.score}: {score}</span>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                     <div className="text-center mb-8">
                         {viewMode === 'GAME_QUIZ' ? (
                             <h2 className="text-4xl font-black text-slate-700 animate-in slide-in-from-top duration-300">
                                 {gameQuestions[questionIndex].target.target}
                             </h2>
                         ) : (
                             <button 
                                onClick={() => speakFast(gameQuestions[questionIndex].target.target)}
                                className="w-32 h-32 bg-indigo-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
                             >
                                 <Volume2 className="w-12 h-12 text-white" />
                             </button>
                         )}
                     </div>

                     <div className="grid grid-cols-1 gap-3">
                         {gameQuestions[questionIndex].options.map((opt: any) => {
                             const isSelected = selectedAnswer === opt.id;
                             const isTarget = opt.id === gameQuestions[questionIndex].target.id;
                             
                             let btnClass = "bg-white border-slate-200 text-slate-600";
                             if (selectedAnswer) {
                                 if (isTarget) btnClass = "bg-green-500 border-green-600 text-white";
                                 else if (isSelected && !isTarget) btnClass = "bg-rose-500 border-rose-600 text-white";
                                 else btnClass = "bg-slate-100 border-slate-200 text-slate-400 opacity-50";
                             }

                             return (
                                 <button
                                    key={opt.id}
                                    onClick={() => handleAnswer(opt.id)}
                                    disabled={!!selectedAnswer}
                                    className={`p-4 rounded-2xl border-2 border-b-4 font-bold text-lg transition-all ${btnClass} ${!selectedAnswer && 'hover:bg-sky-50 active:border-b-2 active:translate-y-[2px]'}`}
                                 >
                                     {viewMode === 'GAME_QUIZ' ? opt.vietnamese : opt.target}
                                 </button>
                             )
                         })}
                     </div>
                </div>
            </div>
        )}

        {/* 5. ACTIVE GAME: MATCHING */}
        {!isGameOver && viewMode === 'GAME_MATCH' && gameQuestions.length > 0 && (
             <div className="flex flex-col h-full">
                 <div className="flex justify-between items-center mb-4">
                    <span className="font-black text-slate-400">{t.matchMode}</span>
                    <span className="font-black text-orange-500 bg-orange-100 px-3 py-1 rounded-lg">{t.score}: {score}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    {gameQuestions.map((card, idx) => {
                        const isFlipped = flippedCards.some(f => f.index === idx) || matchedPairs.includes(card.pairId);
                        const isMatched = matchedPairs.includes(card.pairId);
                        
                        return (
                            <div 
                                key={idx} 
                                onClick={() => handleCardFlip(card, idx)}
                                className={`aspect-[4/3] perspective-1000 cursor-pointer ${isMatched ? 'opacity-0 pointer-events-none transition-opacity duration-500' : ''}`}
                            >
                                <div className={`relative w-full h-full transition-transform duration-300 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                    {/* Back (Hidden) */}
                                    <div className="absolute w-full h-full bg-indigo-500 rounded-2xl backface-hidden border-b-4 border-indigo-700 flex items-center justify-center">
                                         <Sparkles className="text-white/30 w-8 h-8" />
                                    </div>
                                    {/* Front (Shown) */}
                                    <div className={`absolute w-full h-full bg-white rounded-2xl backface-hidden rotate-y-180 border-2 border-b-4 flex items-center justify-center p-2 text-center select-none ${isMatched ? 'border-green-500' : 'border-slate-200'}`}>
                                        <span className="font-extrabold text-slate-700 text-sm md:text-base leading-tight">{card.content}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
             </div>
        )}

      </div>

      {/* ADD NEW WORD MODAL (Same as before) */}
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
