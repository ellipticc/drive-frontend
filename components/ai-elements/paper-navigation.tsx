'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobileDevice } from '@/lib/mobile-utils';

interface Block {
    id?: string;
    type: string;
    content?: string;
}

interface PaperScrollNavigationProps {
    blocks: Block[];
    scrollToBlock?: (id: string, behavior?: ScrollBehavior) => void;
    highlightBlock?: (id: string) => void;
    clearHighlight?: () => void;
}

// Helper to get heading level from block type
const getHeadingLevel = (type: string): number => {
    if (type === 'title') return 0;
    const match = type.match(/h([1-6])/);
    return match ? parseInt(match[1]) : 0;
};

export function PaperScrollNavigation({
    blocks,
    scrollToBlock,
    highlightBlock,
    clearHighlight
}: PaperScrollNavigationProps) {
    const isMobile = useIsMobileDevice();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialMountRef = useRef(true);
    const userInteractionRef = useRef(false);
    const rafRef = useRef<number | null>(null);

    // Filter only blocks that are headers (h1, h2, h3, etc.) with heading levels
    const navigableBlocks = blocks
        .filter(b => b.id && b.type && /^h[1-6]$|title/.test(b.type))
        .map(b => ({
            ...b,
            level: getHeadingLevel(b.type as string)
        }));

    // Hide navigation on mobile devices
    if (isMobile) return null;

    // Handle navigation only on user interaction
    const handleNavigationInfo = (id: string) => {
        userInteractionRef.current = true;

        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);

        if (scrollToBlock) {
            scrollToBlock(id, 'smooth');
        } else {
            const element = document.getElementById(`block-${id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        setActiveId(id);

        // Highlight the block temporarily
        if (highlightBlock) {
            setHighlightedId(id);
            highlightBlock(id);
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = setTimeout(() => {
                setHighlightedId(null);
                if (clearHighlight) clearHighlight();
            }, 2000);
        }

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
        if (navigableBlocks.length === 0) return;

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
                    const id = entry.target.id.replace('block-', '');
                    setActiveId(id);
                }
            });
        };

        observerRef.current = new IntersectionObserver(callback, options);

        navigableBlocks.forEach(block => {
            if (block.id) {
                const el = document.getElementById(`block-${block.id}`);
                if (el) observerRef.current?.observe(el);
            }
        });

        return () => observerRef.current?.disconnect();
    }, [navigableBlocks.length]);

    // Handle URL hash on mount and navigation
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const match = hash.match(/content=([^&]*)/);

            if (match?.[1]) {
                const blockId = match[1];

                // If user hasn't interacted yet, just set activeId (don't open nav)
                if (!userInteractionRef.current) {
                    const element = document.getElementById(`block-${blockId}`);
                    if (element) {
                        setActiveId(blockId);
                    }
                } else {
                    // On subsequent hash changes (user navigation), do full navigation
                    const element = document.getElementById(`block-${blockId}`);
                    if (element) {
                        handleNavigationInfo(blockId);
                    } else {
                        // If element not found, wait for it to render
                        let frameCount = 0;
                        const maxFrames = 30; // ~500ms at 60fps

                        const checkForElement = () => {
                            frameCount++;
                            const el = document.getElementById(`block-${blockId}`);
                            if (el) {
                                handleNavigationInfo(blockId);
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
                const blockId = match[1];
                const element = document.getElementById(`block-${blockId}`);
                if (element) {
                    setActiveId(blockId);
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

    // Stop highlighting when clicking elsewhere or scrolling manually
    useEffect(() => {
        const resetInteraction = () => {
            userInteractionRef.current = false;
            setHighlightedId(null);
            if (clearHighlight) clearHighlight();
        };

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // If click is outside navigation component, stop user interaction to allow passive scroll-based updates
            if (containerRef.current && !containerRef.current.contains(target)) {
                resetInteraction();
            }
        };

        window.addEventListener('wheel', resetInteraction, { passive: true });
        window.addEventListener('touchmove', resetInteraction, { passive: true });
        document.addEventListener('click', handleClickOutside);

        return () => {
            window.removeEventListener('wheel', resetInteraction);
            window.removeEventListener('touchmove', resetInteraction);
            document.removeEventListener('click', handleClickOutside);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        };
    }, [clearHighlight]);

    if (navigableBlocks.length === 0) return null;

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
                {navigableBlocks.map((block) => (
                    <div
                        key={`dash-${block.id}`}
                        className={cn(
                            "h-0.5 rounded-full transition-all duration-300 cursor-pointer",
                            activeId === block.id
                                ? "bg-primary w-4"
                                : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-1.5"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (block.id) handleNavigationInfo(block.id);
                        }}
                    />
                ))}
            </div>

            {/* Hover State: Hierarchical List */}
            <div
                className={cn(
                    "flex flex-col w-full overflow-hidden transition-all duration-300 ease-in-out origin-left rounded-xl bg-sidebar/95 backdrop-blur shadow-2xl border border-sidebar-border",
                    isHovered
                        ? "opacity-100 scale-100 translate-x-0"
                        : "opacity-0 scale-95 -translate-x-4 pointer-events-none absolute"
                )}
            >
                <div className="flex flex-col p-3 gap-0.5 max-h-[60vh] overflow-y-auto w-full scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 pr-1">
                    {navigableBlocks.map((block, idx) => {
                        // Calculate padding based on heading level
                        const paddingLeft = block.level === 0 ? 0 : (block.level - 1) * 12;

                        return (
                            <button
                                key={`item-${block.id}`}
                                onClick={() => block.id && handleNavigationInfo(block.id)}
                                style={{ paddingLeft: `${paddingLeft + 12}px` }}
                                className={cn(
                                    "text-left text-[12px] leading-snug py-2 rounded-lg transition-all w-full group/item hover:bg-muted/40",
                                    "font-medium",
                                    activeId === block.id
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span className={cn(
                                    "line-clamp-2 break-words transition-colors",
                                    activeId === block.id ? "text-primary" : "group-hover/item:text-foreground"
                                )}>
                                    {block.content || `Block ${idx + 1}`}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}