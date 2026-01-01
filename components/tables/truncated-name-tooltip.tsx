"use client";

import React, { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedNameTooltipProps {
    name: string;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    delayDuration?: number;
    maxTooltipWidth?: string;
}

export const TruncatedNameTooltip = ({
    name,
    className,
    onClick,
    delayDuration = 700,
    maxTooltipWidth = "400px"
}: TruncatedNameTooltipProps) => {
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef<HTMLParagraphElement>(null);

    const checkTruncation = () => {
        if (textRef.current) {
            const isCurrentlyTruncated = textRef.current.scrollWidth > textRef.current.clientWidth;
            setIsTruncated(isCurrentlyTruncated);
        }
    };

    // Also check on window resize to be precise
    useEffect(() => {
        const handleResize = () => {
            checkTruncation();
        };

        window.addEventListener('resize', handleResize);
        // Initial check
        checkTruncation();

        return () => window.removeEventListener('resize', handleResize);
    }, [name]);

    return (
        <Tooltip delayDuration={delayDuration}>
            <TooltipTrigger asChild onMouseEnter={checkTruncation}>
                <p
                    ref={textRef}
                    className={cn("truncate flex-1 min-w-0", className)}
                    onClick={onClick}
                >
                    {name}
                </p>
            </TooltipTrigger>
            {isTruncated && (
                <TooltipContent>
                    <p className={cn("break-words", `max-w-[${maxTooltipWidth}]`)} style={{ maxWidth: maxTooltipWidth }}>
                        {name}
                    </p>
                </TooltipContent>
            )}
        </Tooltip>
    );
};
