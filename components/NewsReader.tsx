import React, { useState, useEffect } from 'react';
import { NewsArticle, VocabularyWord, Language } from '../types';
import { ArrowLeft, BookOpen, Volume2, Sparkles, Loader2, Search, X, Save, RefreshCw, Trash2, Heart } from 'lucide-react';
import { generateLookupDetail } from '../services/geminiService';
import { Flashcard } from './Flashcard';
import { TRANSLATIONS } from '../constants/translations';
import { FontSize } from '../App';

interface NewsReaderProps {
    articles: NewsArticle[];
    onBack: () => void;
    speakFast: (text: string, onEnd?: () => void) => void;
    speakAI: (text: string) => void;
    loading: boolean;
    aiLoading: boolean;
    currentLang: Language;
    onAddWord: (word: VocabularyWord) => void; 
    onLoadMore: () => void; 
    onDeleteArticle: (id: string) => void;
    playbackSpeed: number;
    onToggleSpeed: () => void;
    fontSize?: FontSize;
}

export const NewsReader: React.FC<NewsReaderProps> = ({ 
    articles, onBack, speakFast, speakAI, loading, aiLoading, currentLang, onAddWord, onLoadMore, onDeleteArticle,
    playbackSpeed, onToggleSpeed, fontSize = 'normal'
}) => {
    const t = TRANSLATIONS[currentLang];
    const [selectedText, setSelectedText] = useState<string>('');
    const [selectionRect, setSelectionRect] = useState<{top: number, left: number} | null>(null);
    
    // Lookup State
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupResult, setLookupResult] = useState<VocabularyWord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLookupFavorite, setIsLookupFavorite] = useState(false);

    // Handle Text Selection
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                const text = selection.toString().trim();
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                setSelectedText(text);
                setSelectionRect({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX + (rect.width / 2)
                });
            } else {
                if (!isModalOpen) {
                    setSelectedText('');
                    setSelectionRect(null);
                }
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [isModalOpen]);

    const handleLookup = async () => {
        if (!selectedText) return;
        setLookupLoading(true);
        setIsModalOpen(true); 
        setLookupResult(null); 
        setIsLookupFavorite(false);
        
        try {
            const result = await generateLookupDetail(selectedText, currentLang);
            setLookupResult(result);
        } catch (error) {
            console.error(error);
        } finally {
            setLookupLoading(false);
            window.getSelection()?.removeAllRanges();
            setSelectedText('');
            setSelectionRect(null);
        }
    };

    const handleSaveLookup = () => {
        if (lookupResult) {
            onAddWord({
                ...lookupResult,
                mastered: false,
                isFavorite: isLookupFavorite
            });
            alert(t.saveWord + " OK!");
            setIsModalOpen(false);
        }
    };
    
    const getTextSizeClass = () => {
        if (fontSize === 'huge') return 'text-2xl leading-loose';
        if (fontSize === 'large') return 'text-xl leading-relaxed';
        return 'text-lg leading-relaxed';
    }

    const getTranslationSizeClass = () => {
        if (fontSize === 'huge') return 'text-xl leading-relaxed';
        if (fontSize === 'large') return 'text-lg leading-relaxed';
        return 'text-base leading-relaxed';
    }

    const renderFormattedText = (text: string) => {
        return text.split('\n').map((str, index) => (
            <p key={index} className={`mb-4 text-slate-700 font-medium ${getTextSizeClass()}`}>{str}</p>
        ));
    }

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm(t.confirmDelete)) {
            onDeleteArticle(id);
        }
    }

    let langSubtitle = 'Français (A1)';
    if (currentLang === 'en') langSubtitle = 'English (B1)';
    if (currentLang === 'zh') langSubtitle = 'Chinese (A1)';
    if (currentLang === 'es') langSubtitle = 'Spanish (A1)';

    return (
        <div className="flex flex-col h-full bg-gray-100 relative">
            <div className="bg-gray-100/95 backdrop-blur-sm p-4 flex items-center gap-2 sticky top-0 z-10 border-b-2 border-slate-200">
                <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-slate-700 truncate">{t.newsTitle}</h2>
                    <p className="text-xs text-slate-400 font-bold truncate">{langSubtitle}</p>
                </div>
                
                <button 
                    onClick={onToggleSpeed}
                    className="w-10 h-10 flex items-center justify-center bg-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
                >
                    {playbackSpeed}x
                </button>

                <button 
                    onClick={onLoadMore}
                    disabled={loading}
                    className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 disabled:opacity-50 transition-all"
                    title={t.loadMore}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">
                {articles.length === 0 && loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-sky-500" />
                        <p className="font-bold">{t.loadingNews}</p>
                    </div>
                ) : articles.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10 flex flex-col items-center">
                         <p className="font-bold text-lg">{t.noNews}</p>
                         <button onClick={onLoadMore} className="mt-4 text-sky-500 font-bold hover:underline">{t.loadMore}</button>
                    </div>
                ) : (
                    <>
                        {articles.map((article) => (
                            <div key={article.id} className="bg-white rounded-3xl p-6 border-2 border-slate-200 border-b-4 shadow-sm relative group">
                                <button 
                                    onClick={(e) => handleDelete(e, article.id)}
                                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                    title={t.delete}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>

                                <div className="flex flex-col mb-4 border-b-2 border-slate-100 pb-3 pr-10">
                                    <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2">{article.title}</h3>
                                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg w-fit">{article.date}</span>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100">
                                        <div className="flex items-start gap-3 mb-2">
                                            <BookOpen className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                                            <div className="selection:bg-sky-200 selection:text-sky-900">
                                                {renderFormattedText(article.summary)}
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-indigo-200/50">
                                            <p className="text-xs text-indigo-400 font-bold uppercase mr-auto self-center">{t.readAloud}</p>
                                            <button 
                                                onClick={() => speakFast(article.summary)}
                                                className="p-2 rounded-xl bg-white text-slate-400 border-2 border-slate-200 border-b-4 hover:text-sky-500 active:border-b-0 active:translate-y-1 transition-all"
                                            >
                                                <Volume2 className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => speakAI(article.summary)}
                                                disabled={aiLoading}
                                                className="p-2 rounded-xl bg-sky-500 text-white border-sky-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all hover:bg-sky-400 disabled:opacity-50"
                                            >
                                                <Sparkles className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pl-4 border-l-4 border-slate-200 py-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t.translation}</p>
                                        <p className={`text-slate-600 italic ${getTranslationSizeClass()}`}>{article.translation}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Load More Button at bottom */}
                        <button 
                            onClick={onLoadMore} 
                            disabled={loading}
                            className="w-full py-3 rounded-2xl border-2 border-indigo-200 text-indigo-500 font-bold hover:bg-indigo-50 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.loadMore}
                        </button>
                    </>
                )}
            </div>

            {/* Floating Lookup Button */}
            {selectedText && selectionRect && !isModalOpen && (
                <div 
                    className="fixed z-40 animate-in fade-in zoom-in duration-200"
                    style={{ 
                        top: Math.max(10, selectionRect.top + 10), 
                        left: '50%',
                        transform: 'translateX(-50%)' 
                    }}
                >
                    <button 
                        onClick={handleLookup}
                        className="flex items-center gap-2 bg-sky-500 text-white px-4 py-2 rounded-full shadow-xl font-bold border-2 border-white active:scale-95 transition-transform hover:bg-sky-400"
                    >
                        <Search className="w-4 h-4" />
                        {t.lookup}
                    </button>
                </div>
            )}

            {/* Lookup Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm relative">
                         <button 
                            onClick={() => setIsModalOpen(false)} 
                            className="absolute -top-12 right-0 p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 border border-slate-200"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {lookupLoading ? (
                            <div className="bg-white rounded-3xl p-8 text-center border-2 border-slate-200">
                                <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-700 mb-2">{t.analyzing}</h3>
                            </div>
                        ) : lookupResult ? (
                            <div className="flex flex-col gap-4">
                                <Flashcard 
                                    word={{...lookupResult, isFavorite: isLookupFavorite}}
                                    speakFast={speakFast}
                                    speakAI={speakAI}
                                    aiLoading={aiLoading}
                                    isViewMode={true} 
                                    onToggleFavorite={() => setIsLookupFavorite(!isLookupFavorite)}
                                    fontSize={fontSize} // Pass fontSize
                                />
                                
                                <button 
                                    onClick={handleSaveLookup}
                                    className="w-full bg-green-500 text-white py-4 rounded-2xl font-extrabold uppercase tracking-wide border-green-600 border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Save className="w-5 h-5" />
                                    {t.saveWord}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl p-8 text-center border-2 border-rose-200">
                                <p className="text-rose-500 font-bold">Error. Try again.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};