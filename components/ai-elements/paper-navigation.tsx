'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

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

export function PaperScrollNavigation({ 
    blocks, 
    scrollToBlock, 
    highlightBlock,
    clearHighlight 
}: PaperScrollNavigationProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Filter only blocks that have IDs
    const navigableBlocks = blocks.filter(b => b.id && b.type);

    // Handle Scroll logic
    const handleNavigationInfo = (id: string) => {
        // Prevent hover state from jittering during scroll interactions
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);

        if (scrollToBlock) {
            scrollToBlock(id, 'auto');
        } else {
            // Fallback if prop not provided
            const element = document.getElementById(`block-${id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        }

        setActiveId(id);

        // Highlight the block temporarily
        if (highlightBlock) {
            highlightBlock(id);
            // Clear highlight after 2 seconds
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = setTimeout(() => {
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
        // Small delay to prevent flickering when moving between dash and content
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 300);
    };

    // Intersection Observer for Active Highlight
    useEffect(() => {
        if (navigableBlocks.length === 0) return;

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
                    // Extract ID from block-{id}
                    const id = entry.target.id.replace('block-', '');
                    setActiveId(id);
                }
            });
        };

        observerRef.current = new IntersectionObserver(callback, options);

        // Observe all navigable blocks
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
                handleNavigationInfo(blockId);
            }
        };

        // Check initial hash
        handleHashChange();

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    if (navigableBlocks.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className={cn(
                "fixed left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center transition-all duration-500 ease-in-out group/nav",
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

            {/* Hover State: List */}
            <div
                className={cn(
                    "flex flex-col w-full overflow-hidden transition-all duration-500 ease-in-out origin-left rounded-2xl bg-sidebar/95 backdrop-blur shadow-2xl border border-sidebar-border",
                    isHovered
                        ? "opacity-100 scale-100 translate-x-0"
                        : "opacity-0 scale-95 -translate-x-4 pointer-events-none absolute"
                )}
            >
                <div className="flex flex-col p-3 gap-1 max-h-[60vh] overflow-y-auto w-full scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 pr-1">
                    {navigableBlocks.map((block, idx) => (
                        <button
                            key={`item-${block.id}`}
                            onClick={() => block.id && handleNavigationInfo(block.id)}
                            className={cn(
                                "text-left text-[11px] leading-tight px-3 py-2.5 rounded-xl transition-all w-full group/item",
                                activeId === block.id
                                    ? "text-primary font-semibold bg-primary/5"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/5"
                            )}
                        >
                            <span className={cn(
                                "line-clamp-2 break-words transition-colors",
                                activeId === block.id ? "text-primary" : "group-hover/item:text-foreground"
                            )}>
                                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase">
                                    {block.type}
                                </span>
                                {' '}
                                {block.content || `Block ${idx + 1}`}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
