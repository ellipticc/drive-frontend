'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IconMessage, IconArrowUp, IconArrowDown } from '@tabler/icons-react';

interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatScrollNavigationProps {
    messages: Message[];
}

export function ChatScrollNavigation({ messages }: ChatScrollNavigationProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Filter only user messages that have IDs
    const userMessages = messages.filter(m => m.role === 'user' && m.id && m.content);

    // Determine if we should render content based on hydration state
    const shouldRender = mounted && userMessages.length > 0;

    const handleScrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActiveId(id);
        }
    };

    // Optional: Track active message based on scroll position
    useEffect(() => {
        const handleScroll = () => {
            // Simple debounce or throttle could be added here
            let currentActiveId = null;
            for (const msg of userMessages) {
                if (!msg.id) continue;
                const el = document.getElementById(msg.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
                        currentActiveId = msg.id;
                    }
                }
            }
            if (currentActiveId) setActiveId(currentActiveId);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [userMessages]);

    return (
        <div
            className={cn(
                "fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-end pr-2 pl-8 py-8 transition-all duration-300",
                "h-[80vh] w-auto max-w-[300px]",
                shouldRender && isHovered ? "bg-gradient-to-l from-background via-background/90 to-transparent" : "pointer-events-none",
                !shouldRender && "hidden pointer-events-none"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {shouldRender && (
                <div
                    className={cn(
                        "flex flex-col gap-1 items-end transition-all duration-300 pointer-events-auto",
                        isHovered ? "opacity-100 translate-x-0" : "opacity-30 translate-x-4 hover:opacity-100 hover:translate-x-0"
                    )}
                >
                    {userMessages.map((msg, idx) => (
                        <button
                            key={msg.id || idx}
                            onClick={() => msg.id && handleScrollTo(msg.id)}
                            className={cn(
                                "group flex items-center gap-3 py-1 pl-4 pr-1 transition-all rounded-l-full",
                                "hover:bg-muted/50",
                                activeId === msg.id ? "opacity-100" : "opacity-40 hover:opacity-100"
                            )}
                        >
                            <span
                                className={cn(
                                    "text-xs font-medium truncate max-w-[200px] text-right transition-all duration-300 hidden sm:block",
                                    isHovered ? "w-auto opacity-100 scale-100" : "w-0 opacity-0 scale-95 origin-right overflow-hidden"
                                )}
                            >
                                {msg.content.slice(0, 30)}{msg.content.length > 30 ? '...' : ''}
                            </span>
                            <div
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-sm",
                                    activeId === msg.id
                                        ? "bg-primary scale-125"
                                        : "bg-muted-foreground/40 group-hover:bg-primary/70"
                                )}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
