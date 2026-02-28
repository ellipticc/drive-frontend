"use client";

import { useRef, useEffect, useCallback, useState } from 'react';

interface UseSmartScrollProps {
    isLoading: boolean;
    messages: any[];
    threshold?: number;
    bottomPadding?: number;
}

export function useSmartScroll({
    isLoading,
    messages,
    threshold = 100,
    bottomPadding = 20,
}: UseSmartScrollProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const [isAtBottom, setIsAtBottom] = useState(true);
    const [userInterrupted, setUserInterrupted] = useState(false);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        if (behavior === 'smooth') {
            if (scrollEndRef.current) {
                scrollEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        } else {
            // Absolute instant snap to bottom to clear viewport
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                    }
                }, 10); // tiny delay ensures React has flushed the new message heights
            });
        }
        setUserInterrupted(false);
    }, []);

    // Handle scroll events to detect manual interruption
    const onScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        const nearBottom = distanceToBottom < threshold;

        setIsAtBottom(nearBottom);
        setShowScrollToBottom(!nearBottom);

        // If user scrolls up significantly during loading, set interrupted flag
        if (!nearBottom && isLoading) {
            setUserInterrupted(true);
        }

        // If user manually returns to bottom, clear interrupted flag
        if (nearBottom) {
            setUserInterrupted(false);
        }
    }, [isLoading, threshold]);

    // Auto-scroll on content updates or loading state changes
    useEffect(() => {
        if (isLoading && !userInterrupted) {
            scrollToBottom('smooth');
        }
    }, [messages, isLoading, userInterrupted, scrollToBottom]);

    // Immediate scroll on first message or new user message
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'user') {
            scrollToBottom('instant');
        }
    }, [messages.length, scrollToBottom]);

    return {
        scrollContainerRef,
        scrollEndRef,
        isAtBottom,
        userInterrupted,
        showScrollToBottom,
        scrollToBottom,
        onScroll,
    };
}
