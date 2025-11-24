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
}

type ViewMode = 'LIST' | 'GAME_MENU' | 'GAME_QUIZ' | 'GAME_AUDIO' | 'GAME_MATCH' | 'GAME_FILL' | 'GAME_SCRAMBLE';

export const VocabularyList: React.FC<VocabularyListProps> = ({ 
    words, currentLang, onBack, speakFast, speakAI, speakBestAvailable, aiLoading, onDelete, 
    onToggleMastered, onToggleFavorite, playbackSpeed, onToggleSpeed, onAddWord, onEditWord, initialFilter = 'ALL', swipeAutoplay,
    fontSize = 'normal', loopAudio, onToggleLoop
}) => {
  const t = TRANSLATIONS[currentLang];
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  
  // Filter & Sort State
  const [filterType, setFilterType] = useState<FilterType>(initialFilter);
  const [sortType, setSortType] = useState<SortType>('DATE_DESC'); // Default: Newest
  
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
  const [playDelay, setPlayDelay] = useState(2000); // 2000ms = 2s default
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
  
  // Scramble Game State
  const [scrambledLetters, setScrambledLetters] = useState<{id: number, char: string}[]>([]);
  const [userSpelling, setUserSpelling] = useState<{id: number, char: string}[]>([]);

  // Matching Game Specifics
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [flippedCards, setFlippedCards] = useState<{id: string, type: 'target' | 'viet', index: number}[]>([]);

  // 1. Filter Logic
  const filteredWords = words.filter(word => {
    const matchesSearch = word.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          word.vietnamese.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterType === 'FAV') return word.isFavorite;
    if (filterType === 'MASTERED') return word.mastered;
    if (filterType === 'VERBS') return word.category === 'common-verbs' || word.category === 'irregular-verbs';
    
    return true;
  });

  // 2. Sort Logic
  const sortedWords = [...filteredWords].sort((a, b) => {
      switch (sortType) {
          case 'DATE_DESC':
              return (b.learnedAt || 0) - (a.learnedAt || 0);
          case 'DATE_ASC':
              return (a.learnedAt || 0) - (b.learnedAt || 0);
          case 'ALPHA_ASC':
              return a.target.localeCompare(b.target, currentLang === 'zh' ? 'zh-CN' : undefined);
          case 'ALPHA_DESC':
              return b.target.localeCompare(a.target, currentLang === 'zh' ? 'zh-CN' : undefined);
          default:
              return 0;
      }
  });

  // Sort Handlers
  const toggleDateSort = () => {
      if (sortType === 'DATE_DESC') {
          setSortType('DATE_ASC');
      } else {
          setSortType('DATE_DESC');
      }
  };

  const toggleAlphaSort = () => {
      if (sortType === 'ALPHA_ASC') {
          setSortType('ALPHA_DESC');
      } else {
          setSortType('ALPHA_ASC');
      }
  };

  // Use sortedWords for display
  const displayList = sortedWords;

  const selectedWord = selectedWordId ? displayList.find(w => w.id === selectedWordId) : null;

  // --- GLOBAL KEYBOARD SHORTCUTS ---
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          // If modal is active, let the modal specific handler take care of navigation
          if (selectedWordId) return; // Handled by modal effect

          if (e.key === 'Escape') {
              if (viewMode !== 'LIST') {
                  setViewMode('LIST');
              } else {
                  onBack();
              }
          }
          
          // Game Number Shortcuts (1-4)
          if (!isGameOver && !selectedAnswer && (viewMode === 'GAME_QUIZ' || viewMode === 'GAME_FILL' || viewMode === 'GAME_AUDIO') && gameQuestions.length > 0) {
              if (['1', '2', '3', '4'].includes(e.key)) {
                  const idx = parseInt(e.key) - 1;
                  const options = gameQuestions[questionIndex].options;
                  if (options && options[idx]) {
                      handleAnswer(options[idx].id);
                  }
              }
          }
      };

      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedWordId, viewMode, isGameOver, gameQuestions, questionIndex, onBack, selectedAnswer]);


  // --- AUTO PLAY LOGIC ---
  const startAutoPlay = () => {
      if (displayList.length === 0) return;
      
      // User wants sequential auto-play (following sort order) but let's respect the current view
      const queue = [...displayList];
      setPlayQueue(queue);
      
      // Start from top
      setCurrentPlayIndex(0);
      
      setIsAutoPlaying(true);
      setIsPaused(false);
      setShowSettings(false);
      
      // Immediately open the first card
      if (queue.length > 0) {
          setSelectedWordId(queue[0].id);
      }
  };

  const stopAutoPlay = () => {
      setIsAutoPlaying(false);
      setIsPaused(false);
      setPlayQueue([]);
      setCurrentPlayIndex(0);
      // setSelectedWordId(null); // Keep the last card open or close? User probably wants to stay on card
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

  const handleItemClick = (wordId: string) => {
      // Stop auto play immediately if running, this is manual interaction
      if (isAutoPlaying) {
          stopAutoPlay();
      }
      setSelectedWordId(wordId);
      setSwipeX(0); // Ensure clean state

      // AUTO PLAY when opening card manually (optional, based on preference)
      const word = words.find(w => w.id === wordId);
      if (word) {
          setTimeout(() => {
               speakBestAvailable(word.target);
          }, 300);
      }
  }

  // Auto Play Effect Loop (MODIFIED: Jumps Card by opening Modal)
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
    
    // CRITICAL CHANGE: Open the Modal for this word
    setSelectedWordId(word.id);

    let hasAdvanced = false;

    const playNext = () => {
        if (hasAdvanced || !isMountedRef.current || !isAutoPlaying || isPaused) return;
        hasAdvanced = true;
        loopTimeoutRef.current = setTimeout(() => {
             setCurrentPlayIndex(prev => prev + 1);
        }, playDelay);
    };

    // Small delay to allow modal to render
    const startDelay = setTimeout(() => {
        // Use Best Available (Cached AI or Fast)
        speakBestAvailable(word.target, playNext);
    }, 500); // 500ms delay to let transition happen

    return () => {
        clearTimeout(startDelay);
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [currentPlayIndex, isAutoPlaying, isPaused, playQueue, speakBestAvailable, playDelay, loopAudio]);

  // --- MODAL SWIPE & KEYBOARD LOGIC ---
  const handleNextWord = () => {
      if (!selectedWordId) return;
      const idx = displayList.findIndex(w => w.id === selectedWordId);
      if (idx < displayList.length - 1) {
          const nextWord = displayList[idx + 1];
          setSelectedWordId(nextWord.id);
          if (swipeAutoplay) {
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
          if (swipeAutoplay) {
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

  // Add Keyboard support for Modal
  useEffect(() => {
      if (!selectedWordId) return;

      const handleKeyDown = (e: KeyboardEvent) => {
          if (isAnimating) return;

          if (e.key === 'ArrowLeft') {
             // Previous (Right swipe animation brings prev card from left)
             const idx = displayList.findIndex(w => w.id === selectedWordId);
             if (idx > 0) {
                 animateSwipe('right');
             }
          } else if (e.key === 'ArrowRight') {
             // Next (Left swipe animation brings next card from right)
             const idx = displayList.findIndex(w => w.id === selectedWordId);
             if (idx < displayList.length - 1) {
                 animateSwipe('left');
             }
          } else if (e.key === 'Escape') {
              if (isAutoPlaying) stopAutoPlay(); // Stop auto play if manually closing
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
          // Prev
           if (displayList.findIndex(w => w.id === selectedWordId) > 0) {
               animateSwipe('right');
           } else {
               setSwipeX(0);
           }
      } else if (swipeX < -threshold) {
          // Next
           if (displayList.findIndex(w => w.id === selectedWordId) < displayList.length - 1) {
               animateSwipe('left');
           } else {
               setSwipeX(0);
           }
      } else {
          setSwipeX(0);
      }
      startXRef.current = null;
  }
  
  // Styles for Swipe
  const getCardStyle = () => {
      const rotation = swipeX / 20;
      const opacity = 1 - Math.abs(swipeX) / 500;
      return {
          transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
          opacity: opacity,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'
      };
  };

  // ... (GAME LOGIC OMITTED FOR BREVITY) ...
  // [GAME LOGIC HERE] 
  const startGame = (mode: ViewMode) => {
      const pool = displayList;
      if (pool.length < 4) {
          alert(`Not enough words in this list (${pool.length}). Need at least 4.`);
          return;
      }
      setScore(0);
      setQuestionIndex(0);
      setIsGameOver(false);
      setMatchedPairs([]);
      setFlippedCards([]);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setUserSpelling([]);
      setScrambledLetters([]);

      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10); 

      if (mode === 'GAME_QUIZ' || mode === 'GAME_AUDIO') {
          const questions = selected.map(word => {
              const distractors = pool
                  .filter(w => w.id !== word.id)
                  .sort(() => 0.5 - Math.random())
                  .slice(0, 3);
              
              const options = [word, ...distractors].sort(() => 0.5 - Math.random());
              return { target: word, options: options };
          });
          setGameQuestions(questions);
      } 
      else if (mode === 'GAME_FILL') {
          const questions = selected.map(word => {
               const example = word.example.target;
               const regex = new RegExp(word.target, 'gi');
               const masked = example.replace(regex, '_____');
               const questionText = masked.includes('_____') ? masked : `Which word means: "${word.vietnamese}"?`;
               const distractors = pool.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
               const options = [word, ...distractors].sort(() => 0.5 - Math.random());
               return { target: word, questionText, options };
          });
          setGameQuestions(questions);
      }
      else if (mode === 'GAME_SCRAMBLE') {
          const questions = selected.map(word => {
              const cleanTarget = word.target.replace(/[^\p{L}]/gu, ''); 
              const chars = cleanTarget.split('').map((c, i) => ({ id: i, char: c }));
              const shuffledChars = [...chars].sort(() => 0.5 - Math.random());
              return { target: word, chars: shuffledChars };
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
          cards.sort(() => 0.5 - Math.random());
          setGameQuestions(cards);
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
          const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
          audio.volume = 0.5;
          audio.play().catch(() => {});
      } else {
           const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg');
           audio.volume = 0.5;
           audio.play().catch(() => {});
      }
      setTimeout(() => {
          if (questionIndex < gameQuestions.length - 1) {
              const nextIndex = questionIndex + 1;
              setQuestionIndex(nextIndex);
              setSelectedAnswer(null);
              setIsCorrect(null);
              if (viewMode === 'GAME_SCRAMBLE') {
                  setScrambledLetters(gameQuestions[nextIndex].chars);
                  setUserSpelling([]);
              }
          } else {
              setIsGameOver(true);
          }
      }, 2000);
  };

  const handleScrambleTap = (letterObj: {id: number, char: string}) => {
      const newSpelling = [...userSpelling, letterObj];
      setUserSpelling(newSpelling);
      setScrambledLetters(prev => prev.filter(l => l.id !== letterObj.id));
      if (newSpelling.length === gameQuestions[questionIndex].target.target.replace(/[^\p{L}]/gu, '').length) {
          const attempt = newSpelling.map(l => l.char).join('');
          const actual = gameQuestions[questionIndex].target.target.replace(/[^\p{L}]/gu, '');
          if (attempt.toLowerCase() === actual.toLowerCase()) {
              setIsCorrect(true);
              setScore(prev => prev + 10);
               speakBestAvailable(gameQuestions[questionIndex].target.target);
               const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
               audio.play().catch(() => {});
          } else {
              setIsCorrect(false);
               const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg');
               audio.play().catch(() => {});
          }
          setTimeout(() => {
              if (questionIndex < gameQuestions.length - 1) {
                  const next = questionIndex + 1;
                  setQuestionIndex(next);
                  setScrambledLetters(gameQuestions[next].chars);
                  setUserSpelling([]);
                  setIsCorrect(null);
              } else {
                  setIsGameOver(true);
              }
          }, 1500);
      }
  };

  const resetScramble = () => {
      setScrambledLetters([...scrambledLetters, ...userSpelling]);
      setUserSpelling([]);
  }

  const handleCardFlip = (card: any, index: number) => {
      if (flippedCards.length === 2 || matchedPairs.includes(card.pairId)) return;
      if (flippedCards.length === 1 && flippedCards[0].type === card.type && flippedCards[0].id === card.id) return; 
      const newFlipped = [...flippedCards, { ...card, index }];
      setFlippedCards(newFlipped);
      if (newFlipped.length === 2) {
          const match = newFlipped[0].id === newFlipped[1].id;
          if (match) {
              setMatchedPairs(prev => [...prev, newFlipped[0].id]);
              setScore(prev => prev + 20);
              setFlippedCards([]);
              const targetCard = newFlipped.find(c => c.type === 'target');
              if (targetCard) speakBestAvailable(targetCard.content);
              if (matchedPairs.length + 1 === 4) setTimeout(() => setIsGameOver(true), 1500);
          } else {
              setTimeout(() => setFlippedCards([]), 1000);
          }
      }
  };

  useEffect(() => {
      if (viewMode === 'GAME_AUDIO' && !isGameOver && gameQuestions.length > 0 && !selectedAnswer) {
          const word = gameQuestions[questionIndex].target.target;
          setTimeout(() => speakBestAvailable(word), 500);
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
      setNewExTarget(word.example.target);
      setNewExViet(word.example.vietnamese);
      setNewExVietPronun(word.example.viet_pronunciation || '');
      setIsModalOpen(true);
  }

  const handleAddClick = () => {
      setIsEditing(false);
      setEditingId(null);
      setNewTarget('');
      setNewVietnamese('');
      setNewIpa('');
      setNewVietPronun('');
      setNewExTarget('');
      setNewExViet('');
      setNewExVietPronun('');
      setIsModalOpen(true);
  }

  const handleCardToggleMastered = (id: string, status: boolean) => onToggleMastered(id, status);
  const handleListMasterClick = (e: React.MouseEvent, id: string, status: boolean) => { e.stopPropagation(); onToggleMastered(id, status); };
  const handleCardToggleFavorite = (id: string, status: boolean) => onToggleFavorite(id, status);
  const handleListFavoriteClick = (e: React.MouseEvent, id: string, status: boolean) => { e.stopPropagation(); onToggleFavorite(id, status); };

  const handleAutoFill = async () => {
    // ... same as before
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
      // ... same as before
      if (!newTarget.trim() || !newVietnamese.trim()) {
          alert("Please enter word and meaning.");
          return;
      }
      const wordData: VocabularyWord = {
          id: isEditing && editingId ? editingId : Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
          target: newTarget.trim(),
          vietnamese: newVietnamese.trim(),
          ipa: newIpa || '',
          viet_pronunciation: newVietPronun || '',
          example: {
              target: newExTarget || newTarget.trim(),
              vietnamese: newExViet || newVietnamese.trim(),
              viet_pronunciation: newExVietPronun || ''
          },
          learnedAt: isEditing && editingId ? (words.find(w => w.id === editingId)?.learnedAt || Date.now()) : Date.now(),
          category: 'general',
          mastered: isEditing && editingId ? (words.find(w => w.id === editingId)?.mastered || false) : false,
          isFavorite: isEditing && editingId ? (words.find(w => w.id === editingId)?.isFavorite || false) : false
      };
      if (isEditing) onEditWord(wordData);
      else onAddWord(wordData);
      setIsModalOpen(false);
  };
  
  let placeholder = "Ex: Chat";
  if (currentLang === 'en') placeholder = "Ex: Cat";
  if (currentLang === 'zh') placeholder = "Ex: Māo (猫)";
  if (currentLang === 'es') placeholder = "Ex: Gato";

  const currentPlayingId = (isAutoPlaying && playQueue[currentPlayIndex]) ? playQueue[currentPlayIndex].id : null;

  const getListItemTargetSize = () => {
      if (fontSize === 'huge') return 'text-2xl';
      if (fontSize === 'large') return 'text-xl';
      return 'text-lg';
  }
  
  const getListItemMeaningSize = () => {
       if (fontSize === 'huge') return 'text-lg';
       if (fontSize === 'large') return 'text-base';
       return 'text-sm';
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full bg-gray-100 relative">
      {/* Header */}
      <div className="p-4 sticky top-0 z-20 bg-gray-100/95 backdrop-blur-sm border-b-2 border-slate-200">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <button onClick={() => {
                    if (isAutoPlaying) stopAutoPlay();
                    viewMode === 'LIST' ? onBack() : setViewMode('LIST');
                }} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-extrabold text-slate-700">
                        {viewMode === 'LIST' ? t.dictionary : t.playGames}
                    </h2>
                    {viewMode !== 'LIST' && (
                        <p className="text-xs text-slate-400 font-bold uppercase">
                           List: {filterType === 'ALL' ? 'All' : filterType} ({displayList.length})
                        </p>
                    )}
                </div>
            </div>
            
            {viewMode === 'LIST' && (
                <div className="flex items-center gap-2">
                    {/* Only show PLAY button here if NOT auto playing. If AutoPlaying, controls are in overlay now */}
                    {!isAutoPlaying && (
                        <>
                            <button 
                                onClick={startAutoPlay}
                                className="flex items-center justify-center p-2 bg-indigo-500 text-white rounded-xl border-indigo-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                                title={t.autoPlay}
                            >
                                <Play className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={() => setViewMode('GAME_MENU')}
                                className="flex items-center justify-center p-2 bg-orange-500 text-white rounded-xl border-orange-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                                title={t.games}
                            >
                                <Gamepad2 className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={handleAddClick}
                                className="flex items-center justify-center p-2 bg-green-500 text-white rounded-xl border-green-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
        
        {/* ... Search & Filters ... */}
        {viewMode === 'LIST' && !isAutoPlaying && (
            <div className="space-y-2 mt-2">
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
                
                {/* Filters & Sort Row */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     {/* SORT BY DATE */}
                     <button 
                        onClick={toggleDateSort}
                        className={`px-3 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 flex items-center gap-1 ${sortType.includes('DATE') ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        {sortType === 'DATE_DESC' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                        {sortType === 'DATE_DESC' ? t.newest : t.oldest}
                    </button>

                    {/* SORT BY ALPHA */}
                    <button 
                        onClick={toggleAlphaSort}
                        className={`px-3 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 flex items-center gap-1 ${sortType.includes('ALPHA') ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        {sortType === 'ALPHA_DESC' ? <ArrowUpAZ className="w-3 h-3" /> : <ArrowDownAZ className="w-3 h-3" />}
                        {sortType === 'ALPHA_DESC' ? 'Z-A' : 'A-Z'}
                    </button>

                    {/* FILTERS */}
                    <button 
                        onClick={() => setFilterType('ALL')}
                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 ${filterType === 'ALL' ? 'bg-slate-700 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        {t.filterAll}
                    </button>
                    <button 
                        onClick={() => setFilterType('FAV')}
                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 ${filterType === 'FAV' ? 'bg-rose-500 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        <Heart className="w-3 h-3 inline mr-1" /> {t.filterFav}
                    </button>
                    <button 
                        onClick={() => setFilterType('MASTERED')}
                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 ${filterType === 'MASTERED' ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        <CheckCircle className="w-3 h-3 inline mr-1" /> {t.filterMastered}
                    </button>
                    <button 
                        onClick={() => setFilterType('VERBS')}
                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap border-2 ${filterType === 'VERBS' ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        {t.filterVerbs}
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* CONTENT AREA ... (Keep rest of component identical) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-24">
        {viewMode === 'LIST' && (
            <>
                {displayList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-bold text-lg">{t.notFound}</p>
                    </div>
                ) : (
                    displayList.map((word) => {
                        const isPlayingThis = word.id === currentPlayingId;
                        return (
                            <div 
                                id={`word-card-${word.id}`}
                                key={word.id} 
                                onClick={() => handleItemClick(word.id)}
                                className={`rounded-2xl p-4 border-2 border-b-4 flex items-center justify-between transition-all duration-500 ${
                                    isPlayingThis 
                                        ? 'bg-yellow-100 border-yellow-300 scale-105 shadow-lg z-10' 
                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                } ${'cursor-pointer active:border-b-2 active:translate-y-[2px]'}`}
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <div className="flex flex-col">
                                        <h3 className={`font-black truncate transition-colors ${getListItemTargetSize()} ${isPlayingThis ? 'text-yellow-800' : 'text-slate-700 group-hover:text-sky-500'}`}>
                                            {word.target}
                                        </h3>
                                        {currentLang === 'zh' && (
                                            <span className="text-xs font-bold text-slate-400 truncate">{word.ipa}</span>
                                        )}
                                    </div>
                                    
                                    <p className={`font-medium truncate ${getListItemMeaningSize()} ${isPlayingThis ? 'text-yellow-600' : 'text-slate-500'}`}>
                                        {word.vietnamese}
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                    {!isAutoPlaying && (
                                        <>
                                            <button 
                                                onClick={(e) => handleEditClick(e, word)}
                                                className="p-2 rounded-xl text-slate-400 bg-slate-100 border border-slate-200 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>

                                            <button 
                                                onClick={(e) => handleListFavoriteClick(e, word.id, !word.isFavorite)}
                                                className={`p-2 rounded-xl transition-colors border border-slate-200 hover:border-rose-200 ${word.isFavorite ? 'text-rose-500 bg-rose-50 border-rose-200' : 'text-slate-300 bg-slate-50 hover:text-rose-400'}`}
                                            >
                                                <Heart className={`w-4 h-4 ${word.isFavorite ? 'fill-rose-500' : ''}`} />
                                            </button>

                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    speakFast(word.target);
                                                }}
                                                className="p-2 rounded-xl text-slate-400 bg-slate-100 border border-slate-200 hover:text-sky-500 hover:border-sky-300 transition-colors"
                                            >
                                                <Zap className="w-5 h-5" />
                                            </button>
                                            
                                            <button 
                                                onClick={(e) => handleListMasterClick(e, word.id, !word.mastered)}
                                                className={`p-2 rounded-xl transition-colors border border-slate-200 hover:border-green-200 ${word.mastered ? 'text-green-500 bg-green-50 border-green-200' : 'text-slate-300 bg-slate-50 hover:text-green-400'}`}
                                            >
                                                {word.mastered ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                            </button>
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
        
        {/* ... Keep all existing Game Menus and Modals exactly as they are ... */}
        {viewMode === 'GAME_MENU' && (
             <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-orange-100 p-6 rounded-3xl text-center border-2 border-orange-200 mb-2">
                     <Gamepad2 className="w-16 h-16 text-orange-500 mx-auto mb-2" />
                     <h3 className="text-xl font-black text-orange-600">{t.playGames}</h3>
                     <p className="text-orange-400 font-bold text-sm">{displayList.length} words in current list</p>
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
                 <button onClick={() => startGame('GAME_FILL')} className="w-full bg-white border-2 border-slate-200 border-b-4 rounded-2xl p-4 flex items-center gap-4 hover:bg-green-50 active:border-b-2 active:translate-y-[2px] transition-all group">
                    <div className="p-3 bg-green-100 rounded-xl text-green-500 group-hover:scale-110 transition-transform">
                        <Edit3 className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                         <h4 className="text-lg font-extrabold text-slate-700">Fill in Blank</h4>
                         <p className="text-slate-400 text-sm font-bold">Complete the sentence</p>
                    </div>
                </button>
                 <button onClick={() => startGame('GAME_SCRAMBLE')} className="w-full bg-white border-2 border-slate-200 border-b-4 rounded-2xl p-4 flex items-center gap-4 hover:bg-purple-50 active:border-b-2 active:translate-y-[2px] transition-all group">
                    <div className="p-3 bg-purple-100 rounded-xl text-purple-500 group-hover:scale-110 transition-transform">
                        <Shuffle className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                         <h4 className="text-lg font-extrabold text-slate-700">Unscramble</h4>
                         <p className="text-slate-400 text-sm font-bold">Spell the word</p>
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

         {!isGameOver && (viewMode === 'GAME_QUIZ' || viewMode === 'GAME_AUDIO' || viewMode === 'GAME_FILL') && gameQuestions.length > 0 && (
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                    <span className="font-black text-slate-400">Q: {questionIndex + 1}/{gameQuestions.length}</span>
                    <span className="font-black text-orange-500 bg-orange-100 px-3 py-1 rounded-lg">{t.score}: {score}</span>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                     <div className="text-center mb-8">
                         {viewMode === 'GAME_QUIZ' && (
                             <h2 className="text-4xl font-black text-slate-700 animate-in slide-in-from-top duration-300">
                                 {gameQuestions[questionIndex].target.target}
                             </h2>
                         )}
                         
                         {viewMode === 'GAME_FILL' && (
                             <div className="animate-in slide-in-from-top duration-300">
                                 <p className="text-xl font-medium text-slate-500 mb-2">Complete the sentence:</p>
                                 <h2 className="text-2xl font-black text-slate-700 bg-white p-4 rounded-2xl border-2 border-slate-100">
                                     {gameQuestions[questionIndex].questionText}
                                 </h2>
                             </div>
                         )}

                         {viewMode === 'GAME_AUDIO' && (
                             <button 
                                onClick={() => speakBestAvailable(gameQuestions[questionIndex].target.target)}
                                className="w-32 h-32 bg-indigo-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
                             >
                                 <Volume2 className="w-12 h-12 text-white" />
                             </button>
                         )}
                     </div>

                     <div className="grid grid-cols-1 gap-3">
                         {gameQuestions[questionIndex].options.map((opt: any, index: number) => {
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
                                    className={`relative p-4 rounded-2xl border-2 border-b-4 font-bold text-lg transition-all ${btnClass} ${!selectedAnswer && 'hover:bg-sky-50 active:border-b-2 active:translate-y-[2px]'}`}
                                 >
                                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300 border border-slate-200 rounded-md px-1.5 py-0.5 hidden md:block">
                                         {index + 1}
                                     </span>
                                     {viewMode === 'GAME_QUIZ' ? opt.vietnamese : opt.target}
                                 </button>
                             )
                         })}
                     </div>
                </div>
            </div>
        )}

         {!isGameOver && viewMode === 'GAME_SCRAMBLE' && gameQuestions.length > 0 && (
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                     <div className="text-left">
                         <p className="text-xs font-bold text-slate-400">Translate:</p>
                         <p className="text-lg font-black text-slate-700">{gameQuestions[questionIndex].target.vietnamese}</p>
                     </div>
                    <span className="font-black text-orange-500 bg-orange-100 px-3 py-1 rounded-lg">{score}</span>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="flex flex-wrap gap-2 justify-center mb-8 min-h-[60px]">
                        {userSpelling.map((l, idx) => (
                            <div key={idx} className="w-12 h-12 bg-slate-700 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md animate-in zoom-in">
                                {l.char}
                            </div>
                        ))}
                        {userSpelling.length === 0 && (
                            <span className="text-slate-300 italic font-bold self-center">Tap letters below</span>
                        )}
                    </div>
                    {isCorrect !== null && (
                        <div className={`mb-6 px-6 py-2 rounded-xl font-black text-white animate-in fade-in ${isCorrect ? 'bg-green-500' : 'bg-rose-500'}`}>
                            {isCorrect ? 'CORRECT!' : 'TRY AGAIN'}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-3 justify-center">
                        {scrambledLetters.map((l) => (
                            <button 
                                key={l.id}
                                onClick={() => handleScrambleTap(l)}
                                className="w-14 h-14 bg-white border-2 border-b-4 border-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-black text-xl active:border-b-2 active:translate-y-[2px] hover:bg-sky-50 transition-all"
                            >
                                {l.char}
                            </button>
                        ))}
                    </div>
                    <button onClick={resetScramble} className="mt-12 text-slate-400 font-bold uppercase text-xs hover:text-slate-600">
                        Reset Word
                    </button>
                </div>
            </div>
        )}

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
                                    <div className="absolute w-full h-full bg-indigo-500 rounded-2xl backface-hidden border-b-4 border-indigo-700 flex items-center justify-center">
                                         <Sparkles className="text-white/30 w-8 h-8" />
                                    </div>
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

      {/* MODALS */}
       {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border-2 border-slate-200">
                <div className="p-4 border-b-2 border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
                    <h3 className="text-xl font-extrabold text-slate-700">{isEditing ? 'Edit Word' : t.addWord}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                {/* ... Add/Edit Word Form ... */}
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-extrabold text-slate-400 mb-2 uppercase">Word (Target)</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-bold text-lg placeholder:text-slate-300"
                                placeholder={placeholder}
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                            />
                            <button 
                                onClick={handleAutoFill}
                                disabled={isGenerating || !newTarget}
                                className="px-4 bg-sky-500 text-white rounded-2xl font-bold border-sky-600 border-b-4 active:border-b-0 active:translate-y-1 hover:bg-sky-400 transition-all disabled:opacity-50 disabled:active:border-b-4 disabled:active:translate-y-0"
                                title="Auto-fill details with AI"
                            >
                                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                    {/* ... Rest of form inputs ... */}
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
                            <label className="block text-sm font-extrabold text-slate-400 mb-2 uppercase">IPA / Pinyin</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl focus:border-sky-500 outline-none font-mono text-sm"
                                value={newIpa}
                                onChange={(e) => setNewIpa(e.target.value)}
                            />
                        </div>
                    </div>

                    {currentLang !== 'en' && (
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

      {/* SELECTED WORD MODAL WITH SWIPE */}
      {selectedWord && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-auto overflow-hidden outline-none"
            onClick={() => {
                if (isAutoPlaying) stopAutoPlay();
                setSelectedWordId(null);
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            tabIndex={0}
        >
            {/* AUTO PLAY CONTROLS OVERLAY (When Modal is Open) */}
            {isAutoPlaying && (
                <div className="absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
                     <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 pointer-events-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-black text-indigo-500 px-2 min-w-[50px] text-center">
                                {currentPlayIndex + 1}/{playQueue.length}
                            </span>
                            
                            <button 
                                onClick={onToggleLoop}
                                className={`p-2 rounded-xl transition-colors ${loopAudio ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                            >
                                <Repeat className="w-5 h-5" />
                            </button>

                            <button 
                                onClick={togglePause}
                                className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400"
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
                </div>
            )}

            {/* Navigation Arrows (Visual cues for Desktop/Tablet) */}
            <button 
                onClick={(e) => { e.stopPropagation(); animateSwipe('right'); }}
                disabled={displayList.indexOf(selectedWord) === 0}
                className="hidden md:block absolute left-4 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md disabled:opacity-20 transition-all z-50"
            >
                <ChevronLeft className="w-8 h-8" />
            </button>

            <div 
                className="relative w-full max-w-lg flex flex-col items-center"
                style={getCardStyle()}
            >
                <div onClick={(e) => e.stopPropagation()} className="w-full">
                    <Flashcard 
                        key={selectedWord.id} // Force re-render on swipe
                        word={selectedWord} 
                        speakFast={speakFast}
                        speakAI={speakAI}
                        speakBestAvailable={speakBestAvailable}
                        aiLoading={aiLoading}
                        onToggleMastered={handleCardToggleMastered}
                        onToggleFavorite={handleCardToggleFavorite}
                        currentLang={currentLang}
                        isViewMode={true}
                        fontSize={fontSize} 
                    />
                </div>
                
                {!isAutoPlaying && (
                    <div 
                        className="mt-4 flex justify-center gap-4 w-full" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={(e) => {
                                setSelectedWordId(null);
                                handleEditClick(e, selectedWord);
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-2xl font-bold border border-white/20 hover:bg-white/20 transition-colors backdrop-blur-md"
                        >
                            <Pencil className="w-5 h-5" /> Edit
                        </button>

                        <button 
                            onClick={(e) => handleDelete(e, selectedWord.id)}
                            className="flex items-center gap-2 px-6 py-3 bg-rose-500/20 text-rose-300 rounded-2xl font-bold border border-rose-500/30 hover:bg-rose-500/30 transition-colors backdrop-blur-md"
                        >
                            <Trash2 className="w-5 h-5" /> {t.delete}
                        </button>
                    </div>
                )}
            </div>

            <button 
                onClick={(e) => { e.stopPropagation(); animateSwipe('left'); }}
                disabled={displayList.indexOf(selectedWord) === displayList.length - 1}
                className="hidden md:block absolute right-4 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md disabled:opacity-20 transition-all z-50"
            >
                <ChevronRight className="w-8 h-8" />
            </button>
        </div>
      )}
    </div>
  );
};
