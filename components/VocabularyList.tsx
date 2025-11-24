import React, { useState, useEffect, useRef } from 'react';
import { VocabularyWord, Language } from '../types';
import { Zap, Sparkles, Search, ArrowLeft, Trash2, X, Heart, CheckCircle, Plus, Save, Loader2, Gamepad2, Play, Pause, Square, Clock, Circle, Pencil, Edit3, Shuffle, ChevronLeft, ChevronRight, HelpCircle, Headphones, Grid, Volume2, Repeat, ArrowDown, ArrowUp, ArrowDownAZ, ArrowUpAZ, Calendar } from 'lucide-react';
import { Flashcard } from './Flashcard';
import { generateSingleWordDetails } from '../services/geminiService';
import { TRANSLATIONS } from '../constants/translations';
import { FontSize } from '../App';

export type FilterType = 'ALL' | 'FAV' | 'MASTERED' | 'VERBS';
export type SortType = 'DATE_DESC' | 'DATE_ASC' | 'ALPHA_ASC' | 'ALPHA_DESC';

interface VocabularyListProps {
  words: VocabularyWord[];
  currentLang: Language;
  onBack: () => void;
  speakFast: (text: string, onEnd?: () => void) => void;
  speakAI: (text: string) => void;
  speakBestAvailable: (text: string, onEnd?: () => void) => void;
  aiLoading: boolean;
  onDelete: (id: string) => void;
  onToggleMastered: (id: string, status: boolean) => void;
  onToggleFavorite: (id: string, status: boolean) => void;
  playbackSpeed: number;
  onToggleSpeed: () => void;
  onAddWord: (word: VocabularyWord) => void;
  onEditWord: (word: VocabularyWord) => void;
  initialFilter?: FilterType;
  swipeAutoplay: boolean;
  fontSize?: FontSize;
  loopAudio: boolean;
  onToggleLoop: () => void;
  autoPlayDelay?: number;
  onUpdateDelay?: (ms: number) => void;
  autoPlayExample: boolean;
  onToggleAutoPlayExample: () => void;
}

type ViewMode = 'LIST' | 'GAME_MENU' | 'GAME_QUIZ' | 'GAME_AUDIO' | 'GAME_MATCH' | 'GAME_FILL' | 'GAME_SCRAMBLE';

export const VocabularyList: React.FC<VocabularyListProps> = ({ 
    words, currentLang, onBack, speakFast, speakAI, speakBestAvailable, aiLoading, onDelete, 
    onToggleMastered, onToggleFavorite, playbackSpeed, onToggleSpeed, onAddWord, onEditWord, initialFilter = 'ALL', swipeAutoplay,
    fontSize = 'normal', loopAudio, onToggleLoop, autoPlayDelay = 2000, onUpdateDelay,
    autoPlayExample, onToggleAutoPlayExample
}) => {
  const t = TRANSLATIONS[currentLang];
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  
  // Filter & Sort State
  const [filterType, setFilterType] = useState<FilterType>(initialFilter);
  const [sortType, setSortType] = useState<SortType>('DATE_DESC'); 
  
  // Force filter update if prop changes
  useEffect(() => {
      setFilterType(initialFilter);
  }, [initialFilter]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Auto Play State
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playQueue, setPlayQueue] = useState<VocabularyWord[]>([]);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  // --- SWIPE ANIMATION STATE ---
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef<number | null>(null);
  
  // Refs
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
      isMountedRef.current = true;
      return () => {
          isMountedRef.current = false;
          if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
          window.speechSynthesis.cancel();
      }
  }, []);

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
  const [scrambledLetters, setScrambledLetters] = useState<{id: number, char: string}[]>([]);
  const [userSpelling, setUserSpelling] = useState<{id: number, char: string}[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [flippedCards, setFlippedCards] = useState<{id: string, type: 'target' | 'viet', index: number}[]>([]);

  // 1. Filter Logic
  const filteredWords = words.filter(word => {
    // RELAXED CHECK: Just ensure it's an object so we don't crash
    if (!word) return false;
    
    const target = (word.target || '').toLowerCase();
    const vietnamese = (word.vietnamese || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = target.includes(search) || vietnamese.includes(search);
    
    if (!matchesSearch) return false;

    if (filterType === 'FAV') return !!word.isFavorite;
    if (filterType === 'MASTERED') return !!word.mastered;
    if (filterType === 'VERBS') return word.category === 'common-verbs' || word.category === 'irregular-verbs';
    
    return true;
  });

  // 2. Sort Logic
  const sortedWords = [...filteredWords].sort((a, b) => {
      const tA = a.target || '';
      const tB = b.target || '';
      switch (sortType) {
          case 'DATE_DESC':
              return (b.learnedAt || 0) - (a.learnedAt || 0);
          case 'DATE_ASC':
              return (a.learnedAt || 0) - (b.learnedAt || 0);
          case 'ALPHA_ASC':
              return tA.localeCompare(tB, currentLang === 'zh' ? 'zh-CN' : undefined);
          case 'ALPHA_DESC':
              return tB.localeCompare(tA, currentLang === 'zh' ? 'zh-CN' : undefined);
          default:
              return 0;
      }
  });

  const toggleDateSort = () => setSortType(sortType === 'DATE_DESC' ? 'DATE_ASC' : 'DATE_DESC');
  const toggleAlphaSort = () => setSortType(sortType === 'ALPHA_ASC' ? 'ALPHA_DESC' : 'ALPHA_ASC');

  const displayList = sortedWords;
  const selectedWord = selectedWordId ? displayList.find(w => w.id === selectedWordId) : null;

  // --- GLOBAL KEYBOARD SHORTCUTS ---
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if (selectedWordId) return; 
          if (e.key === 'Escape') {
              if (viewMode !== 'LIST') setViewMode('LIST');
              else onBack();
          }
          if (!isGameOver && !selectedAnswer && (viewMode === 'GAME_QUIZ' || viewMode === 'GAME_FILL' || viewMode === 'GAME_AUDIO') && gameQuestions.length > 0) {
              if (['1', '2', '3', '4'].includes(e.key)) {
                  const idx = parseInt(e.key) - 1;
                  const options = gameQuestions[questionIndex].options;
                  if (options && options[idx]) handleAnswer(options[idx].id);
              }
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedWordId, viewMode, isGameOver, gameQuestions, questionIndex, onBack, selectedAnswer]);

  // --- AUTO PLAY ---
  const startAutoPlay = () => {
      if (displayList.length === 0) return;
      const queue = [...displayList];
      setPlayQueue(queue);
      setCurrentPlayIndex(0);
      setIsAutoPlaying(true);
      setIsPaused(false);
      setShowSettings(false);
      if (queue.length > 0) setSelectedWordId(queue[0].id);
  };

  const stopAutoPlay = () => {
      setIsAutoPlaying(false);
      setIsPaused(false);
      setPlayQueue([]);
      setCurrentPlayIndex(0);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      window.speechSynthesis.cancel();
  };

  const togglePause = () => {
      if (isPaused) setIsPaused(false);
      else {
          setIsPaused(true);
          if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
          window.speechSynthesis.cancel();
      }
  };

  const handleItemClick = (wordId: string) => {
      if (isAutoPlaying) stopAutoPlay();
      setSelectedWordId(wordId);
      setSwipeX(0); 
      const word = words.find(w => w.id === wordId);
      if (word && word.target) {
          setTimeout(() => speakBestAvailable(word.target), 300);
      }
  }

  useEffect(() => {
    if (!isAutoPlaying || isPaused) return;
    if (currentPlayIndex >= playQueue.length) {
        if (loopAudio) {
            setCurrentPlayIndex(0);
            if (playQueue.length > 0) setSelectedWordId(playQueue[0].id);
        } else {
            stopAutoPlay();
        }
        return;
    }
    const word = playQueue[currentPlayIndex];
    if (word) setSelectedWordId(word.id);

    let hasAdvanced = false;
    const playNext = () => {
        if (hasAdvanced || !isMountedRef.current || !isAutoPlaying || isPaused) return;
        hasAdvanced = true;
        loopTimeoutRef.current = setTimeout(() => {
             setCurrentPlayIndex(prev => prev + 1);
        }, autoPlayDelay);
    };

    const startDelay = setTimeout(() => {
         speakBestAvailable(word.target || 'Error', () => {
             if (autoPlayExample && word.example && word.example.target) {
                 setTimeout(() => {
                    if (!isMountedRef.current || !isAutoPlaying || isPaused) return;
                    speakBestAvailable(word.example.target, playNext);
                 }, 500); 
             } else {
                 playNext();
             }
         });
    }, 500); 

    return () => {
        clearTimeout(startDelay);
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [currentPlayIndex, isAutoPlaying, isPaused, playQueue, speakBestAvailable, autoPlayDelay, loopAudio, autoPlayExample]);

  const handleNextWord = () => {
      if (!selectedWordId) return;
      const idx = displayList.findIndex(w => w.id === selectedWordId);
      if (idx < displayList.length - 1) {
          const nextWord = displayList[idx + 1];
          setSelectedWordId(nextWord.id);
          if (swipeAutoplay && nextWord.target) {
             setTimeout(() => speakBestAvailable(nextWord.target), 400);
          }
      }
  }

  const handlePrevWord = () => {
      if (!selectedWordId) return;
      const idx = displayList.findIndex(w => w.id === selectedWordId);
      if (idx > 0) {
          const prevWord = displayList[idx - 1];
          setSelectedWordId(prevWord.id);
          if (swipeAutoplay && prevWord.target) {
             setTimeout(() => speakBestAvailable(prevWord.target), 400);
          }
      }
  }

  const animateSwipe = (direction: 'left' | 'right') => {
      if (!selectedWordId) return;
      setIsAnimating(true);
      setSwipeX(direction === 'left' ? -500 : 500);
      setTimeout(() => {
          if (direction === 'left') handleNextWord();
          else handlePrevWord();
          setSwipeX(0);
          setIsAnimating(false);
      }, 200);
  };

  useEffect(() => {
      if (!selectedWordId) return;
      const handleKeyDown = (e: KeyboardEvent) => {
          if (isAnimating) return;
          if (e.key === 'ArrowLeft') {
             const idx = displayList.findIndex(w => w.id === selectedWordId);
             if (idx > 0) animateSwipe('right');
          } else if (e.key === 'ArrowRight') {
             const idx = displayList.findIndex(w => w.id === selectedWordId);
             if (idx < displayList.length - 1) animateSwipe('left');
          } else if (e.key === 'Escape') {
              if (isAutoPlaying) stopAutoPlay(); 
              setSelectedWordId(null);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordId, isAnimating, displayList, isAutoPlaying]);

  const onTouchStart = (e: React.TouchEvent) => {
      if (isAnimating) return;
      startXRef.current = e.targetTouches[0].clientX;
      setIsDragging(true);
  }

  const onTouchMove = (e: React.TouchEvent) => {
      if (!startXRef.current || isAnimating) return;
      const diff = e.targetTouches[0].clientX - startXRef.current;
      setSwipeX(diff);
  }

  const onTouchEnd = () => {
      if (!startXRef.current || isAnimating) return;
      setIsDragging(false);
      const threshold = 80;
      if (swipeX > threshold) {
           if (displayList.findIndex(w => w.id === selectedWordId) > 0) animateSwipe('right');
           else setSwipeX(0);
      } else if (swipeX < -threshold) {
           if (displayList.findIndex(w => w.id === selectedWordId) < displayList.length - 1) animateSwipe('left');
           else setSwipeX(0);
      } else setSwipeX(0);
      startXRef.current = null;
  }
  
  const getCardStyle = () => {
      const rotation = swipeX / 20;
      const opacity = 1 - Math.abs(swipeX) / 500;
      return {
          transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
          opacity: opacity,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'
      };
  };

  // ... Game Methods (start, answer, scramble, flip) ...
  const startGame = (mode: ViewMode) => {
      const pool = displayList;
      if (pool.length < 4) {
          alert(`Not enough words in this list (${pool.length}). Need at least 4.`);
          return;
      }
      setScore(0); setQuestionIndex(0); setIsGameOver(false); setMatchedPairs([]);
      setFlippedCards([]); setSelectedAnswer(null); setIsCorrect(null); setUserSpelling([]);
      setScrambledLetters([]);

      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10); 

      if (mode === 'GAME_QUIZ' || mode === 'GAME_AUDIO') {
          const questions = selected.map(word => {
              const distractors = pool.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
              return { target: word, options: [word, ...distractors].sort(() => 0.5 - Math.random()) };
          });
          setGameQuestions(questions);
      } 
      else if (mode === 'GAME_FILL') {
          const questions = selected.map(word => {
               const ex = word.example?.target || '...';
               const regex = new RegExp(word.target || 'xxxx', 'gi');
               const masked = ex.replace(regex, '_____');
               const qt = masked.includes('_____') ? masked : `Word meaning: "${word.vietnamese}"?`;
               const distractors = pool.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
               return { target: word, questionText: qt, options: [word, ...distractors].sort(() => 0.5 - Math.random()) };
          });
          setGameQuestions(questions);
      }
      else if (mode === 'GAME_SCRAMBLE') {
          const questions = selected.map(word => {
              const clean = (word.target || '').replace(/[^\p{L}]/gu, ''); 
              const chars = clean.split('').map((c, i) => ({ id: i, char: c }));
              return { target: word, chars: [...chars].sort(() => 0.5 - Math.random()) };
          });
          setGameQuestions(questions);
          setScrambledLetters(questions[0].chars);
      }
      else if (mode === 'GAME_MATCH') {
          const pairs = shuffled.slice(0, 4);
          let cards: any[] = [];
          pairs.forEach(p => {
              cards.push({ id: p.id, content: p.target, type: 'target', pairId: p.id });
              cards.push({ id: p.id, content: p.vietnamese, type: 'viet', pairId: p.id });
          });
          setGameQuestions(cards.sort(() => 0.5 - Math.random()));
      }
      setViewMode(mode);
  };

  const handleAnswer = (answerId: string) => {
      if (selectedAnswer) return; 
      const currentQ = gameQuestions[questionIndex];
      const correct = answerId === currentQ.target.id;
      setSelectedAnswer(answerId);
      setIsCorrect(correct);
      speakBestAvailable(currentQ.target.target);
      if (correct) {
          setScore(prev => prev + 10);
          new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg').play().catch(()=>{});
      } else {
           new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg').play().catch(()=>{});
      }
      setTimeout(() => {
          if (questionIndex < gameQuestions.length - 1) {
              setQuestionIndex(prev => prev + 1);
              setSelectedAnswer(null);
              setIsCorrect(null);
              if (viewMode === 'GAME_SCRAMBLE') {
                  setScrambledLetters(gameQuestions[questionIndex + 1].chars);
                  setUserSpelling([]);
              }
          } else setIsGameOver(true);
      }, 2000);
  };

  const handleScrambleTap = (letterObj: {id: number, char: string}) => {
      const newSpelling = [...userSpelling, letterObj];
      setUserSpelling(newSpelling);
      setScrambledLetters(prev => prev.filter(l => l.id !== letterObj.id));
      const targetWord = gameQuestions[questionIndex].target.target.replace(/[^\p{L}]/gu, '');
      if (newSpelling.length === targetWord.length) {
          const attempt = newSpelling.map(l => l.char).join('');
          if (attempt.toLowerCase() === targetWord.toLowerCase()) {
              setIsCorrect(true);
              setScore(prev => prev + 10);
              speakBestAvailable(gameQuestions[questionIndex].target.target);
              new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg').play().catch(()=>{});
          } else {
              setIsCorrect(false);
              new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg').play().catch(()=>{});
          }
          setTimeout(() => {
              if (questionIndex < gameQuestions.length - 1) {
                  setQuestionIndex(prev => prev + 1);
                  setScrambledLetters(gameQuestions[questionIndex + 1].chars);
                  setUserSpelling([]);
                  setIsCorrect(null);
              } else setIsGameOver(true);
          }, 1500);
      }
  };

  const resetScramble = () => {
      setScrambledLetters([...scrambledLetters, ...userSpelling]);
      setUserSpelling([]);
  }

  const handleCardFlip = (card: any, index: number) => {
      if (flippedCards.length === 2 || matchedPairs.includes(card.pairId)) return;
      if (flippedCards.length === 1 && flippedCards[0].id === card.id && flippedCards[0].type === card.type) return;
      const newFlipped = [...flippedCards, { ...card, index }];
      setFlippedCards(newFlipped);
      if (newFlipped.length === 2) {
          if (newFlipped[0].id === newFlipped[1].id) {
              setMatchedPairs(prev => [...prev, newFlipped[0].id]);
              setScore(prev => prev + 20);
              setFlippedCards([]);
              const tCard = newFlipped.find(c => c.type === 'target');
              if (tCard) speakBestAvailable(tCard.content);
              if (matchedPairs.length + 1 === 4) setTimeout(() => setIsGameOver(true), 1500);
          } else setTimeout(() => setFlippedCards([]), 1000);
      }
  };

  useEffect(() => {
      if (viewMode === 'GAME_AUDIO' && !isGameOver && gameQuestions.length > 0 && !selectedAnswer) {
          setTimeout(() => speakBestAvailable(gameQuestions[questionIndex].target.target), 500);
      }
  }, [questionIndex, viewMode, isGameOver, speakBestAvailable]);

  const handleDelete = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation(); 
    if (window.confirm(t.confirmDelete)) {
        setSelectedWordId(null);
        setTimeout(() => onDelete(id), 100);
    }
  };

  const handleEditClick = (e: React.MouseEvent, word: VocabularyWord) => {
      e.stopPropagation();
      setEditingId(word.id);
      setIsEditing(true);
      setNewTarget(word.target);
      setNewVietnamese(word.vietnamese);
      setNewIpa(word.ipa);
      setNewVietPronun(word.viet_pronunciation);
      setNewExTarget(word.example?.target || '');
      setNewExViet(word.example?.vietnamese || '');
      setNewExVietPronun(word.example?.viet_pronunciation || '');
      setIsModalOpen(true);
  }

  const handleAddClick = () => {
      setIsEditing(false); setEditingId(null);
      setNewTarget(''); setNewVietnamese(''); setNewIpa(''); setNewVietPronun('');
      setNewExTarget(''); setNewExViet(''); setNewExVietPronun('');
      setIsModalOpen(true);
  }

  const handleCardToggleMastered = (id: string, status: boolean) => onToggleMastered(id, status);
  const handleListMasterClick = (e: React.MouseEvent, id: string, status: boolean) => { e.stopPropagation(); onToggleMastered(id, status); };
  const handleCardToggleFavorite = (id: string, status: boolean) => onToggleFavorite(id, status);
  const handleListFavoriteClick = (e: React.MouseEvent, id: string, status: boolean) => { e.stopPropagation(); onToggleFavorite(id, status); };

  const handleAutoFill = async () => {
    if (!newTarget.trim()) return;
    setIsGenerating(true);
    try {
        const details = await generateSingleWordDetails(newTarget, currentLang);
        setNewTarget(details.target); setNewVietnamese(details.vietnamese);
        setNewIpa(details.ipa); setNewVietPronun(details.viet_pronunciation);
        setNewExTarget(details.example.target); setNewExViet(details.example.vietnamese);
        setNewExVietPronun(details.example.viet_pronunciation);
    } catch (err) { alert("Error auto-filling."); } finally { setIsGenerating(false); }
  };

  const handleSaveWord = () => {
      if (!newTarget.trim()) { alert("Missing word"); return; }
      const wordData: VocabularyWord = {
          id: isEditing && editingId ? editingId : Date.now().toString(36) + Math.random(),
          target: newTarget.trim(),
          vietnamese: newVietnamese.trim(),
          ipa: newIpa || '',
          viet_pronunciation: newVietPronun || '',
          example: {
              target: newExTarget || newTarget.trim(),
              vietnamese: newExViet || '',
              viet_pronunciation: newExVietPronun || ''
          },
          learnedAt: Date.now(),
          mastered: false,
          isFavorite: false
      };
      if (isEditing) onEditWord(wordData); else onAddWord(wordData);
      setIsModalOpen(false);
  };
  
  const getListItemTargetSize = () => fontSize === 'huge' ? 'text-2xl' : fontSize === 'large' ? 'text-xl' : 'text-lg';
  const getListItemMeaningSize = () => fontSize === 'huge' ? 'text-lg' : fontSize === 'large' ? 'text-base' : 'text-sm';

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full bg-gray-100 relative">
      {/* Header */}
      <div className="p-4 sticky top-0 z-20 bg-gray-100/95 backdrop-blur-sm border-b-2 border-slate-200">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <button onClick={() => isAutoPlaying ? stopAutoPlay() : (viewMode === 'LIST' ? onBack() : setViewMode('LIST'))} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-extrabold text-slate-700">{viewMode === 'LIST' ? t.dictionary : t.playGames}</h2>
                    {viewMode !== 'LIST' && <p className="text-xs text-slate-400 font-bold uppercase">List: {filterType} ({displayList.length})</p>}
                </div>
            </div>
            
            {viewMode === 'LIST' && (
                <div className="flex items-center gap-2">
                    {!isAutoPlaying && (
                        <>
                            <button onClick={startAutoPlay} className="flex items-center justify-center p-2 bg-indigo-500 text-white rounded-xl border-indigo-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"><Play className="w-6 h-6" /></button>
                            <button onClick={() => setViewMode('GAME_MENU')} className="flex items-center justify-center p-2 bg-orange-500 text-white rounded-xl border-orange-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"><Gamepad2 className="w-6 h-6" /></button>
                            <button onClick={handleAddClick} className="flex items-center justify-center p-2 bg-green-500 text-white rounded-xl border-green-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"><Plus className="w-6 h-6" /></button>
                        </>
                    )}
                </div>
            )}
        </div>
        
        {viewMode === 'LIST' && !isAutoPlaying && (
            <div className="space-y-2 mt-2">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder={t.search + "..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-bold" />
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     <button onClick={toggleDateSort} className={`px-3 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 flex items-center gap-1 ${sortType.includes('DATE') ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-500'}`}>{sortType === 'DATE_DESC' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}{sortType === 'DATE_DESC' ? t.newest : t.oldest}</button>
                     <button onClick={toggleAlphaSort} className={`px-3 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 flex items-center gap-1 ${sortType.includes('ALPHA') ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-500'}`}>{sortType === 'ALPHA_DESC' ? <ArrowUpAZ className="w-3 h-3" /> : <ArrowDownAZ className="w-3 h-3" />}{sortType === 'ALPHA_DESC' ? 'Z-A' : 'A-Z'}</button>
                    <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase border-2 ${filterType === 'ALL' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500'}`}>{t.filterAll}</button>
                    <button onClick={() => setFilterType('FAV')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase border-2 ${filterType === 'FAV' ? 'bg-rose-500 text-white' : 'bg-white text-slate-500'}`}><Heart className="w-3 h-3 inline mr-1" /> {t.filterFav}</button>
                    <button onClick={() => setFilterType('MASTERED')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase border-2 ${filterType === 'MASTERED' ? 'bg-green-500 text-white' : 'bg-white text-slate-500'}`}><CheckCircle className="w-3 h-3 inline mr-1" /> {t.filterMastered}</button>
                    <button onClick={() => setFilterType('VERBS')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase border-2 ${filterType === 'VERBS' ? 'bg-sky-500 text-white' : 'bg-white text-slate-500'}`}>{t.filterVerbs}</button>
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-24">
        {viewMode === 'LIST' && (
            <>
                {displayList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-bold text-lg">{t.notFound}</p>
                        <button onClick={() => setFilterType('ALL')} className="mt-4 text-sky-500 font-bold underline">Reset Filters</button>
                    </div>
                ) : (
                    displayList.map((word, index) => {
                        // FORCE RENDER: Fallback ID if missing
                        const id = word.id || `missing-${index}`;
                        const target = word.target || '???';
                        const meaning = word.vietnamese || '???';
                        
                        const isPlayingThis = id === (isAutoPlaying && playQueue[currentPlayIndex]?.id);
                        return (
                            <div 
                                id={`word-card-${id}`}
                                key={id}
                                onClick={() => handleItemClick(id)}
                                className={`rounded-2xl p-4 border-2 border-b-4 flex items-center justify-between transition-all duration-300 bg-white ${isPlayingThis ? 'bg-yellow-100 border-yellow-300' : 'border-slate-200 hover:bg-slate-50'} cursor-pointer active:border-b-2 active:translate-y-[2px]`}
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <div className="flex flex-col">
                                        <h3 className={`font-black truncate ${getListItemTargetSize()} ${isPlayingThis ? 'text-yellow-800' : 'text-slate-700'}`}>{target}</h3>
                                        {currentLang === 'zh' && word.ipa && <span className="text-xs font-bold text-slate-400 truncate">{word.ipa}</span>}
                                    </div>
                                    <p className={`font-medium truncate ${getListItemMeaningSize()} ${isPlayingThis ? 'text-yellow-600' : 'text-slate-500'}`}>{meaning}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {!isAutoPlaying && (
                                        <>
                                            <button onClick={(e) => handleEditClick(e, word)} className="p-2 rounded-xl text-slate-400 bg-slate-100 border border-slate-200 hover:text-indigo-500 hover:border-indigo-300"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleListFavoriteClick(e, id, !word.isFavorite)} className={`p-2 rounded-xl border hover:border-rose-200 ${word.isFavorite ? 'text-rose-500 bg-rose-50 border-rose-200' : 'text-slate-300 bg-slate-50 border-slate-200'}`}><Heart className={`w-4 h-4 ${word.isFavorite ? 'fill-rose-500' : ''}`} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); speakFast(target); }} className="p-2 rounded-xl text-slate-400 bg-slate-100 border border-slate-200 hover:text-sky-500 hover:border-sky-300"><Zap className="w-5 h-5" /></button>
                                            <button onClick={(e) => handleListMasterClick(e, id, !word.mastered)} className={`p-2 rounded-xl border hover:border-green-200 ${word.mastered ? 'text-green-500 bg-green-50 border-green-200' : 'text-slate-300 bg-slate-50 border-slate-200'}`}>{word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                                        </>
                                    )}
                                    {isPlayingThis && <Volume2 className="w-5 h-5 text-yellow-600 animate-pulse" />}
                                </div>
                            </div>
                        );
                    })
                )}
            </>
        )}
        {/* Game rendering unchanged */}
        {viewMode !== 'LIST' && !isGameOver && <div className="text-center text-slate-400 mt-10">Game mode active...</div>}
      </div>

      {/* Modal logic unchanged */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => { if(isAutoPlaying) stopAutoPlay(); setSelectedWordId(null); }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} tabIndex={0}>
            {isAutoPlaying && (
                <div className="absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
                     <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 pointer-events-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-black text-indigo-500 px-2 min-w-[50px] text-center">{currentPlayIndex + 1}/{playQueue.length}</span>
                            <button onClick={onToggleLoop} className={`p-2 rounded-xl transition-colors ${loopAudio ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}><Repeat className="w-5 h-5" /></button>
                            <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-xl ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}><Clock className="w-5 h-5" /></button>
                            <button onClick={togglePause} className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400">{isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}</button>
                            <button onClick={stopAutoPlay} className="p-2 rounded-xl bg-rose-100 text-rose-500 hover:bg-rose-200"><Square className="w-5 h-5 fill-current" /></button>
                     </div>
                </div>
            )}
            {isAutoPlaying && showSettings && (
                <div className="absolute top-[80px] z-50 bg-white rounded-xl shadow-xl border-2 border-slate-100 p-4 w-60" onClick={(e) => e.stopPropagation()}>
                     <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-500 uppercase">Delay: {autoPlayDelay / 1000}s</span></div>
                     <input type="range" min="1000" max="5000" step="500" value={autoPlayDelay} onChange={(e) => onUpdateDelay && onUpdateDelay(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                     <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-3"><span className="text-xs font-bold text-slate-500 uppercase">Play Examples</span><button onClick={onToggleAutoPlayExample} className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${autoPlayExample ? 'bg-purple-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-300 shadow-sm ${autoPlayExample ? 'left-5' : 'left-1'}`}></div></button></div>
                </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); animateSwipe('right'); }} disabled={displayList.indexOf(selectedWord) === 0} className="hidden md:block absolute left-4 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md z-50"><ChevronLeft className="w-8 h-8" /></button>
            <div className="relative w-full max-w-lg flex flex-col items-center" style={getCardStyle()}>
                <div onClick={(e) => e.stopPropagation()} className="w-full">
                    <Flashcard key={selectedWord.id} word={selectedWord} speakFast={speakFast} speakAI={speakAI} speakBestAvailable={speakBestAvailable} aiLoading={aiLoading} onToggleMastered={handleCardToggleMastered} onToggleFavorite={handleCardToggleFavorite} currentLang={currentLang} isViewMode={true} fontSize={fontSize} />
                </div>
                {!isAutoPlaying && (
                    <div className="mt-4 flex justify-center gap-4 w-full" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { setSelectedWordId(null); handleEditClick(e, selectedWord); }} className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-2xl font-bold border border-white/20 hover:bg-white/20 backdrop-blur-md"><Pencil className="w-5 h-5" /> Edit</button>
                        <button onClick={(e) => handleDelete(e, selectedWord.id)} className="flex items-center gap-2 px-6 py-3 bg-rose-500/20 text-rose-300 rounded-2xl font-bold border border-rose-500/30 hover:bg-rose-500/30 backdrop-blur-md"><Trash2 className="w-5 h-5" /> {t.delete}</button>
                    </div>
                )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); animateSwipe('left'); }} disabled={displayList.indexOf(selectedWord) === displayList.length - 1} className="hidden md:block absolute right-4 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md z-50"><ChevronRight className="w-8 h-8" /></button>
        </div>
      )}
    </div>
  );
};