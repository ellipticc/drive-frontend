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
                isHovered ? "w-[260px]" : "w-12"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
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
                            "h-1 rounded-full transition-all duration-300",
                            activeId === msg.id ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                        )}
                    />
                ))}
            </div>

            {/* Hover State: Card List (Only visible when hovered) */}
            <Card
                className={cn(
                    "flex flex-col overflow-hidden transition-all duration-300 origin-right shadow-xl border-border/50",
                    "bg-sidebar", // Match sidebar background as requested
                    isHovered ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 translate-x-4 pointer-events-none absolute right-0"
                )}
            >
                <div className="flex flex-col max-h-[60vh] overflow-y-auto p-2 w-[260px]">
                    {userMessages.map((msg) => (
                        <div
                            key={msg.id}
                            onClick={() => msg.id && handleNavigationInfo(msg.id)}
                            className={cn(
                                "cursor-pointer px-3 py-2 rounded-md text-sm transition-colors text-left truncate relative",
                                activeId === msg.id
                                    ? "bg-accent text-accent-foreground font-medium"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            {/* Marker line for active state */}
                            {activeId === msg.id && (
                                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
                            )}

                            {/* Truncated Content */}
                            {msg.content.split('\n')[0].slice(0, 50)}
                            {msg.content.split('\n')[0].length > 50 ? '...' : ''}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
