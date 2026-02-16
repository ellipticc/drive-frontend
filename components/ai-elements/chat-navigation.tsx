'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

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
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Filter only user messages that have IDs
    const userMessages = messages.filter(m => m.role === 'user' && m.id && m.content);

    // Handle Scroll logic (Exact Top, Instant)
    const handleNavigationInfo = (id: string) => {
        // Prevent hover state from jittering during scroll interactions
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);

        if (scrollToMessage) {
            scrollToMessage(id, 'auto');
        } else {
            // Fallback if prop not provided
            const element = document.getElementById(`message-${id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        }
        setActiveId(id);
    };

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        // Small delay to prevent flickering when moving between dash and content
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 300);
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
                "fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center transition-all duration-500 ease-in-out group/nav",
                isHovered ? "w-[260px] px-2" : "w-8"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Idle State: Centered Dashes (Horizontal Lines) */}
            <div
                className={cn(
                    "flex flex-col items-center gap-1.5 transition-all duration-500 ease-in-out",
                    isHovered ? "opacity-0 pointer-events-none absolute scale-50" : "opacity-100 scale-100"
                )}
            >
                {userMessages.map((msg) => (
                    <div
                        key={`dash-${msg.id}`}
                        className={cn(
                            "h-0.5 rounded-full transition-all duration-300 cursor-pointer",
                            activeId === msg.id
                                ? "bg-primary w-4"
                                : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-1.5"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (msg.id) handleNavigationInfo(msg.id);
                        }}
                    />
                ))}
            </div>

            {/* Hover State: List */}
            <div
                className={cn(
                    "flex flex-col w-full overflow-hidden transition-all duration-500 ease-in-out origin-right rounded-2xl bg-sidebar/95 backdrop-blur shadow-2xl border border-sidebar-border",
                    isHovered
                        ? "opacity-100 scale-100 translate-x-0"
                        : "opacity-0 scale-95 translate-x-4 pointer-events-none absolute"
                )}
            >
                <div className="flex flex-col p-3 gap-1 max-h-[60vh] overflow-y-auto w-full scrollbar-thin">
                    {userMessages.map((msg, idx) => (
                        <button
                            key={`item-${msg.id}`}
                            onClick={() => msg.id && handleNavigationInfo(msg.id)}
                            className={cn(
                                "text-left text-[11px] leading-tight px-3 py-2.5 rounded-xl transition-all w-full group/item",
                                activeId === msg.id
                                    ? "text-primary font-semibold bg-primary/5"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/5"
                            )}
                        >
                            <span className={cn(
                                "line-clamp-2 break-words transition-colors",
                                activeId === msg.id ? "text-primary" : "group-hover/item:text-foreground"
                            )}>
                                {msg.content || `Message ${idx + 1}`}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
