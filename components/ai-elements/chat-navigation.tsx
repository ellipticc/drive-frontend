'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobileDevice } from '@/lib/mobile-utils';

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
    const isMobile = useIsMobileDevice();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialMountRef = useRef(true);
    const userInteractionRef = useRef(false);
    const rafRef = useRef<number | null>(null);

    // Filter only user messages that have IDs
    const userMessages = messages.filter(m => m.role === 'user' && m.id && m.content);

    // Hide navigation on mobile devices
    if (isMobile) return null;

    // Handle navigation only on user interaction
    const handleNavigationInfo = (id: string) => {
        userInteractionRef.current = true;
        
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);

        if (scrollToMessage) {
            scrollToMessage(id, 'auto');
        } else {
            const element = document.getElementById(`message-${id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        }
        setActiveId(id);

        // Update URL with content fragment
        window.history.replaceState(
            null, 
            '', 
            `${window.location.pathname}${window.location.search}#content=${id}`
        );
    };

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        // Faster delay for snappier hover behavior
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 150);
    };

    // Intersection Observer for Active Highlight - passive, doesn't open nav
    useEffect(() => {
        if (userMessages.length === 0) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const options = {
            root: null,
            rootMargin: '-10% 0px -80% 0px',
            threshold: 0
        };

        const callback: IntersectionObserverCallback = (entries) => {
            entries.forEach(entry => {
                // Only update on scroll if user hasn't manually interacted
                if (entry.isIntersecting && !userInteractionRef.current) {
                    const id = entry.target.id.replace('message-', '');
                    setActiveId(id);
                }
            });
        };

        observerRef.current = new IntersectionObserver(callback, options);

        userMessages.forEach(msg => {
            if (msg.id) {
                const el = document.getElementById(`message-${msg.id}`);
                if (el) observerRef.current?.observe(el);
            }
        });

        return () => observerRef.current?.disconnect();
    }, [userMessages.length]);

    // Handle URL hash on mount and navigation
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const match = hash.match(/content=([^&]*)/);
            
            if (match?.[1]) {
                const messageId = match[1];
                
                // If user hasn't interacted yet, just set activeId (don't open nav)
                if (!userInteractionRef.current) {
                    const element = document.getElementById(`message-${messageId}`);
                    if (element) {
                        setActiveId(messageId);
                    }
                } else {
                    // On subsequent hash changes (user navigation), do full navigation
                    const element = document.getElementById(`message-${messageId}`);
                    if (element) {
                        handleNavigationInfo(messageId);
                    } else {
                        // If element not found, wait for it to render
                        let frameCount = 0;
                        const maxFrames = 30; // ~500ms at 60fps
                        
                        const checkForElement = () => {
                            frameCount++;
                            const el = document.getElementById(`message-${messageId}`);
                            if (el) {
                                handleNavigationInfo(messageId);
                                rafRef.current = null;
                            } else if (frameCount < maxFrames) {
                                rafRef.current = requestAnimationFrame(checkForElement);
                            } else {
                                rafRef.current = null;
                            }
                        };
                        
                        rafRef.current = requestAnimationFrame(checkForElement);
                    }
                }
            }
        };

        // On mount, read hash silently (don't trigger navigation)
        setTimeout(() => {
            const hash = window.location.hash;
            const match = hash.match(/content=([^&]*)/);
            if (match?.[1]) {
                const messageId = match[1];
                const element = document.getElementById(`message-${messageId}`);
                if (element) {
                    setActiveId(messageId);
                }
            }
            // Mark initial mount as complete - now future hash changes are user-driven
            isInitialMountRef.current = false;
        }, 0);

        window.addEventListener('hashchange', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    if (userMessages.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className={cn(
                "fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center transition-all duration-300 ease-in-out group/nav",
                isHovered ? "w-[280px] px-3" : "w-10"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Idle State: Centered Dashes (Horizontal Lines) */}
            <div
                className={cn(
                    "flex flex-col items-center gap-2 transition-all duration-300 ease-in-out",
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
                    "flex flex-col w-full overflow-hidden transition-all duration-300 ease-in-out origin-right rounded-xl bg-sidebar/95 backdrop-blur shadow-2xl border border-sidebar-border",
                    isHovered
                        ? "opacity-100 scale-100 translate-x-0"
                        : "opacity-0 scale-95 translate-x-4 pointer-events-none absolute"
                )}
            >
                <div className="flex flex-col p-3 gap-0.5 max-h-[60vh] overflow-y-auto w-full scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 pr-1">
                    {userMessages.map((msg, idx) => (
                        <button
                            key={`item-${msg.id}`}
                            onClick={() => msg.id && handleNavigationInfo(msg.id)}
                            className={cn(
                                "text-left text-[12px] leading-snug py-2 px-3 rounded-lg transition-all w-full group/item hover:bg-muted/40",
                                "font-medium",
                                activeId === msg.id
                                    ? "text-primary bg-primary/10"
                                    : "text-muted-foreground hover:text-foreground"
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
