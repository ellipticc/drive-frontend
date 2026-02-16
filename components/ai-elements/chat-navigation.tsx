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
                "fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end transition-all duration-300",
                isHovered ? "w-auto max-w-[260px]" : "w-12"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Idle State: Dashes */}
            <div
                className={cn(
                    "flex flex-col gap-1.5 p-2 transition-opacity duration-200 absolute right-0",
                    isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
            >
                {userMessages.map((msg) => (
                    <div
                        key={`dash-${msg.id}`}
                        className={cn(
                            "w-1.5 h-6 rounded-full transition-all duration-300 cursor-pointer",
                            activeId === msg.id ? "bg-primary h-8" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        )}
                        onClick={() => msg.id && handleNavigationInfo(msg.id)}
                    />
                ))}
            </div>

            {/* Hover State: Card List */}
            <Card
                className={cn(
                    "flex flex-col w-full overflow-hidden transition-all duration-300 bg-sidebar/95 backdrop-blur shadow-lg border-sidebar-border origin-right",
                    isHovered ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 translate-x-4 pointer-events-none absolute right-0"
                )}
            >
                <div className="flex flex-col p-2 gap-1 max-h-[60vh] overflow-y-auto min-w-[200px]">
                    {userMessages.map((msg, idx) => (
                        <button
                            key={`item-${msg.id}`}
                            onClick={() => msg.id && handleNavigationInfo(msg.id)}
                            className={cn(
                                "text-left text-xs px-2 py-2 rounded-md transition-colors w-full",
                                activeId === msg.id
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            <span className="line-clamp-2 break-words">
                                {msg.content || `Message ${idx + 1}`}
                            </span>
                        </button>
                    ))}
                </div>
            </Card>
        </div>
    );
}
