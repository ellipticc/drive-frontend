
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CitationParserProps {
    content: string;
    sources?: { title: string; url: string; content?: string }[];
}

export function CitationParser({ content, sources = [] }: CitationParserProps) {
    if (!content) return null;

    // Regex to match both [1] and 【1】 formats
    const parts = content.split(/(\[\d+\]|【\d+】)/g);

    return (
        <span>
            {parts.map((part, i) => {
                // Try standard format [N]
                let match = part.match(/^\[(\d+)\]$/);
                // If not found, try full-width format 【N】
                if (!match) {
                    match = part.match(/^【(\d+)】$/);
                }
                
                if (match) {
                    const index = parseInt(match[1], 10);
                    // Adjust index if sources are 0-indexed but citations are 1-indexed
                    const source = sources[index - 1];

                    if (source) {
                        return (
                            <TooltipProvider key={i} delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <sup
                                            className="ml-0.5 cursor-pointer text-primary font-bold hover:underline select-none"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(source.url, '_blank');
                                            }}
                                        >
                                            [{index}]
                                        </sup>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[300px] p-3 text-xs">
                                        <div className="font-semibold mb-1 truncate">{source.title}</div>
                                        <div className="text-muted-foreground line-clamp-3">{source.content || source.url}</div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    }
                    // If no matching source, show as standard format
                    return <sup key={i} className="text-muted-foreground ml-0.5">[{index}]</sup>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
}
