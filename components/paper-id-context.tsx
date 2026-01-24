'use client';

import React, { createContext, useContext } from 'react';

const PaperIdContext = createContext<string | undefined>(undefined);

export const PaperIdProvider: React.FC<{ paperId: string; children: React.ReactNode }> = ({ paperId, children }) => {
    return (
        <PaperIdContext.Provider value={paperId}>
            {children}
        </PaperIdContext.Provider>
    );
};

export const usePaperId = () => {
    const context = useContext(PaperIdContext);
    if (context === undefined) {
        throw new Error('usePaperId must be used within a PaperIdProvider');
    }
    return context;
};
