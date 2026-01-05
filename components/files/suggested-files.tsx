import React, { useRef, useState, useEffect } from "react";
import { RecentItem } from "@/hooks/use-recent-files";
import { SuggestedFileCard } from "./suggested-file-card";
import { Button } from "@/components/ui/button";
import { IconEye, IconEyeOff, IconChevronLeft, IconChevronRight, IconSparkles } from "@tabler/icons-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SuggestedFilesProps {
    items: RecentItem[];
    isVisible: boolean;
    onToggleVisibility: () => void;
    onNavigate: (item: RecentItem) => void;
    // Action handlers passed down
    onPreview?: (id: string, name: string, mimeType: string) => void;
    onShare: (id: string, name: string, type: "file" | "folder") => void;
    onStar: (id: string, type: "file" | "folder", isStarred: boolean) => void;
    onMoveToFolder: (id: string, name: string, type: "file" | "folder") => void;
    onCopy: (id: string, name: string, type: "file" | "folder") => void;
    onRename: (id: string, name: string, type: "file" | "folder") => void;
    onDetails: (id: string, name: string, type: "file" | "folder") => void;
    onMoveToTrash: (id: string, name: string, type: "file" | "folder") => void;
}

export const SuggestedFiles = ({
    items,
    isVisible,
    onToggleVisibility,
    onNavigate,
    ...actionHandlers
}: SuggestedFilesProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1); // -1 for rounding
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    }, [items, isVisible]);

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = 200 * 3; // Scroll approx 3 cards
            scrollContainerRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
            // Re-check after scroll animation (approx 300ms)
            setTimeout(checkScroll, 300);
        }
    };

    if (items.length === 0) return null;

    return (
        <TooltipProvider delayDuration={400}>
            <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center justify-between mb-2 px-6">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[13px] font-semibold text-foreground/90 tracking-tight">Suggested for you</h2>
                        </div>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
                                    onClick={onToggleVisibility}
                                >
                                    {isVisible ? <IconEye className="h-3.5 w-3.5" /> : <IconEyeOff className="h-3.5 w-3.5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p className="text-[10px] font-medium">{isVisible ? "Hide suggestions" : "Show suggestions"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {isVisible && (
                        <div className="flex items-center gap-1.5 pr-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-muted/50 rounded-full transition-colors"
                                        onClick={() => scroll("left")}
                                        disabled={!canScrollLeft}
                                    >
                                        <IconChevronLeft className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-[10px] font-medium">Scroll left</p>
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-muted/50 rounded-full transition-colors"
                                        onClick={() => scroll("right")}
                                        disabled={!canScrollRight}
                                    >
                                        <IconChevronRight className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-[10px] font-medium">Scroll right</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    )}
                </div>

                {isVisible && (
                    <div
                        ref={scrollContainerRef}
                        className="flex gap-5 overflow-x-auto pb-4 -mb-4 px-6 no-scrollbar scroll-smooth"
                        onScroll={checkScroll}
                    >
                        {items.length > 0 && items.map((item) => (
                            <SuggestedFileCard
                                key={item.id}
                                item={item}
                                onNavigate={onNavigate}
                                {...actionHandlers}
                            />
                        ))}
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
};
