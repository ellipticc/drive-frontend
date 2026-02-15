'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatScrollNavigationProps {
    messages: Message[];
    scrollToMessage?: (id: string, behavior?: ScrollBehavior) => void;
}

export function ChatScrollNavigation({ messages, scrollToMessage }: ChatScrollNavigationProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter only user messages that have IDs
    const userMessages = messages.filter(m => m.role === 'user' && m.id && m.content);

    // Handle Scroll logic (DeepSeek style: Exact Top)
    const handleNavigationInfo = (id: string) => {
        if (scrollToMessage) {
            scrollToMessage(id, 'smooth');
        } else {
            // Fallback if prop not provided
            const element = document.getElementById(`message-${id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        setActiveId(id);
    };

    // Intersection Observer for Active Highlight
    useEffect(() => {
        if (userMessages.length === 0) return;

        // Cleanup previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const options = {
            root: null, // viewport
            rootMargin: '-10% 0px -80% 0px', // Highlight when near top
            threshold: 0
        };

        const callback: IntersectionObserverCallback = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Extract ID from message-{id}
                    const id = entry.target.id.replace('message-', '');
                    setActiveId(id);
                }
            });
        };

        observerRef.current = new IntersectionObserver(callback, options);

        // Observe all user messages
        userMessages.forEach(msg => {
            if (msg.id) {
                const el = document.getElementById(`message-${msg.id}`);
                if (el) observerRef.current?.observe(el);
            }
        });

        return () => observerRef.current?.disconnect();
    }, [userMessages.length]); // Re-run when message count changes

    if (userMessages.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className={cn(
                "fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1 transition-all duration-300",
                "max-h-[80vh] w-[260px]", // Fixed width for alignment
                !isHovered && "pointer-events-none" // Allow clicking through when not hovered
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* 
                Blur Effect Layer (Underlay) 
                Applies ONLY when NOT hovering 
            */}
            <div
                className={cn(
                    "absolute inset-0 bg-background/0 transition-all duration-300 rounded-xl",
                    !isHovered && "backdrop-blur-[1px] opacity-100" // Subtle blur when inactive
                )}
            />

            {/* Scroll Container */}
            <div
                className={cn(
                    "flex flex-col gap-1.5 overflow-y-auto pr-2 py-4 pl-4 transition-all duration-300",
                    "scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/50", // Custom scrollbar
                    isHovered ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-30 translate-x-8 pointer-events-auto" // Slide out partially
                )}
                style={{
                    maskImage: isHovered ? 'none' : 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
                }}
            >
                {userMessages.map((msg) => (
                    <div
                        key={msg.id}
                        onClick={() => msg.id && handleNavigationInfo(msg.id)}
                        className={cn(
                            "cursor-pointer transition-all duration-200 group relative",
                            // Hover state transform/card
                            isHovered ? "bg-card/80 border border-border/40 hover:bg-muted/80 shadow-sm rounded-lg p-3" : "py-1 text-right pr-2"
                        )}
                        role="button"
                    >
                        {/* Active Indicator Line (Left of card) */}
                        {activeId === msg.id && isHovered && (
                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r full" />
                        )}

                        {/* Content */}
                        <div className={cn(
                            "text-sm font-medium truncate transition-colors",
                            activeId === msg.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                            !isHovered && "text-xs opacity-60"
                        )}>
                            {/* Extract First Line & Truncate */}
                            {msg.content.split('\n')[0].slice(0, 60)}
                            {msg.content.split('\n')[0].length > 60 || msg.content.includes('\n') ? '...' : ''}
                        </div>

                        {/* Active Dot (When collapsed/not hovered) */}
                        {!isHovered && activeId === msg.id && (
                            <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
