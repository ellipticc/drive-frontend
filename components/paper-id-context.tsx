'use client';

import React, { createContext, useContext } from 'react';

export interface WordCountStats {
    words: number;
    characters: number;
    sentences: number;
}

interface PaperContextType {
    paperId: string;
    wordCountStats?: WordCountStats;
}

const PaperIdContext = createContext<PaperContextType | undefined>(undefined);

export const PaperIdProvider: React.FC<{ paperId: string; wordCountStats?: WordCountStats; children: React.ReactNode }> = ({ paperId, wordCountStats, children }) => {
    return (
        <PaperIdContext.Provider value={{ paperId, wordCountStats }}>
            {children}
        </PaperIdContext.Provider>
    );
};

export const usePaperId = () => {
    const context = useContext(PaperIdContext);
    if (context === undefined) {
        throw new Error('usePaperId must be used within a PaperIdProvider');
    }
    return context.paperId;
};

export const useWordCountStats = () => {
    const context = useContext(PaperIdContext);
    if (context === undefined) {
        throw new Error('useWordCountStats must be used within a PaperIdProvider');
    }
    return context.wordCountStats;
};
