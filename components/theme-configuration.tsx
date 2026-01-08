"use client";

import { useEffect } from "react";
import { useUser } from "./user-context";
import { useTheme } from "next-themes";

export function ThemeConfiguration() {
    const { user } = useUser();
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (!user) return;

        // Apply appearance theme (skin) class
        const skin = user.appearance_theme || 'default';
        const allSkins = [
            'cosmic-night',
            'claude',
            'mono',
            'caffeine',
            'neo-brutalism',
            'perpetuity',
            'soft-pop',
            'mocha-mousse',
            'quantum-rose'
        ];

        // Only update classes if the skin has actually changed
        if (!document.documentElement.classList.contains(skin) || (skin === 'default' && allSkins.some(s => document.documentElement.classList.contains(s)))) {
            document.documentElement.classList.remove(...allSkins);
            if (skin !== 'default') {
                document.documentElement.classList.add(skin);
            }
        }

        // Persist to cookie for SSR/flash prevention
        document.cookie = `appearance_theme=${skin}; path=/; max-age=31536000; SameSite=Lax`;

        // Handle theme sync (mode)
        if (user.theme_sync) {
            if (theme !== 'system') {
                setTheme('system');
            }
        } else if (theme === 'system') {
            // Only force dark if we're stuck in system mode with sync OFF
            setTheme('dark');
        }
    }, [user?.appearance_theme, user?.theme_sync, theme, setTheme]);

    return null;
}
