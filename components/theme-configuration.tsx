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
        const allSkins = ['cosmic-night', 'claude', 'mono', 'caffeine', 'neo-brutalism', 'perpetuity', 'soft-pop'];

        document.documentElement.classList.remove(...allSkins);
        if (skin !== 'default') {
            document.documentElement.classList.add(skin);
        }

        // Persist to cookie for SSR/flash prevention
        document.cookie = `appearance_theme=${skin}; path=/; max-age=31536000; SameSite=Lax`;

        // Handle theme sync (mode)
        if (user.theme_sync) {
            if (theme !== 'system') {
                setTheme('system');
            }
        } else {
            // If sync is off and we are in system mode, default to dark
            if (theme === 'system') {
                setTheme('dark');
            }
        }
    }, [user?.appearance_theme, user?.theme_sync, theme, setTheme]);

    return null;
}
