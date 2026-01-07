"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import { Language } from './dictionaries';
import { useUser } from '@/components/user-context';
import { apiClient } from '@/lib/api';
import i18n from './i18n';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: string, variables?: Record<string, string | number>) => string;
    dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const { t, i18n: i18nInstance } = useTranslation();
    const { user, updateUser } = useUser();
    const [language, setLanguageState] = useState<Language>(i18nInstance.language as Language || 'en');

    // Sync state with i18n instance
    useEffect(() => {
        setLanguageState(i18nInstance.language as Language);
    }, [i18nInstance.language]);

    // Initialize language preference from user profile
    useEffect(() => {
        if (user?.language && isValidLanguage(user.language) && user.language !== i18nInstance.language) {
            i18nInstance.changeLanguage(user.language);
        }
    }, [user, i18nInstance]);

    const setLanguage = async (lang: Language) => {
        await i18nInstance.changeLanguage(lang);

        // Update document direction
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = lang;

        // Persist to backend and update local user context/cache
        if (user?.id) {
            try {
                // Update local context/cache first
                updateUser({ language: lang });

                // Then notify backend
                await apiClient.updateProfile({ language: lang });
            } catch (error) {
                console.error('Failed to persist language preference:', error);
            }
        }
    };

    const dir = 'ltr';

    // Update HTML dir on language change
    useEffect(() => {
        document.documentElement.dir = dir;
        document.documentElement.lang = language;
    }, [language, dir]);

    const customT = (key: string, variables?: Record<string, string | number>) => {
        return t(key, variables);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t: customT, dir }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

function isValidLanguage(lang: string): boolean {
    return ['en', 'fr', 'es', 'de'].includes(lang);
}
