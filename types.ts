export interface ExampleSentence {
    target: string; // French or English
    vietnamese: string;
    viet_pronunciation: string;
}

export interface VocabularyWord {
    id: string;
    target: string; // French or English
    vietnamese: string;
    ipa: string;
    viet_pronunciation: string;
    example: ExampleSentence;
    learnedAt?: number;
    mastered?: boolean;
    isFavorite?: boolean;
    category?: 'general' | 'common-verbs' | 'irregular-verbs';
}

export interface NewsArticle {
    id: string;
    title: string;
    summary: string; // A1 level summary
    translation: string; // Vietnamese translation
    sourceUrl?: string; // Link to original article
    date: string;
}

export type Language = 'fr' | 'en';

export enum AppMode {
    LANGUAGE_SELECT = 'LANGUAGE_SELECT',
    DASHBOARD = 'DASHBOARD',
    GENERATING = 'GENERATING',
    STUDY_LIST = 'STUDY_LIST',
    FLASHCARD = 'FLASHCARD',
    COMPLETE = 'COMPLETE',
    VOCAB_LIST = 'VOCAB_LIST',
    NEWS_READER = 'NEWS_READER'
}

export enum StudyType {
    NEW = 'NEW',
    REVIEW = 'REVIEW'
}