import React from "react";
import { RecentItem } from "@/hooks/use-recent-files";
import { FileIcon } from "@/components/file-icon";
import { IconFolder, IconShare3, IconDotsVertical } from "@tabler/icons-react";
import { FileActionsMenu } from "./file-actions-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cx } from "@/utils/cx";
import { TruncatedNameTooltip } from "@/components/tables/truncated-name-tooltip";

interface SuggestedFileCardProps {
    item: RecentItem;
    onNavigate: (item: RecentItem) => void;
    // Action handlers
    onPreview?: (id: string, name: string, mimeType: string) => void;
    onShare: (id: string, name: string, type: "file" | "folder") => void;
    onStar: (id: string, type: "file" | "folder", isStarred: boolean) => void;
    onMoveToFolder: (id: string, name: string, type: "file" | "folder") => void;
    onCopy: (id: string, name: string, type: "file" | "folder") => void;
    onRename: (id: string, name: string, type: "file" | "folder") => void;
    onDetails: (id: string, name: string, type: "file" | "folder") => void;
    onMoveToTrash: (id: string, name: string, type: "file" | "folder") => void;
}

export const SuggestedFileCard = ({
    item,
    onNavigate,
    onPreview,
    onShare,
    onStar,
    onMoveToFolder,
    onCopy,
    onRename,
    onDetails,
    onMoveToTrash,
}: SuggestedFileCardProps) => {
    return (
        <div
            className="group relative flex items-center justify-between min-w-[240px] w-[240px] h-[64px] p-2.5 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/40 hover:border-primary/10 transition-colors duration-200 cursor-pointer select-none"
            onClick={() => onNavigate(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    onNavigate(item);
                }
            }}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex-shrink-0 p-1.5 grayscale-[0.2] group-hover:grayscale-0 transition-all">
                    {item.type === "folder" ? (
                        <IconFolder className="h-5 w-5 text-blue-500" />
                    ) : (
                        <FileIcon mimeType={item.mimeType || "application/octet-stream"} filename={item.name} className="h-5 w-5" />
                    )}
                </div>

                <div className="flex flex-col justify-center items-start flex-1 min-w-0 overflow-hidden px-1">
                    <TruncatedNameTooltip
                        name={item.name}
                        className="font-medium text-[13px] text-foreground/90 truncate block leading-tight text-left w-full"
                    />
                    <div className="flex items-center justify-start gap-1.5 text-[10px] text-muted-foreground/70 mt-0.5 w-full">
                        <span className="uppercase tracking-wider font-semibold">
                            {item.type === "folder" ? "Folder" : (item.mimeType?.split('/').pop()?.toUpperCase() || "FILE")}
                        </span>
                        <span>•</span>
                        <span>Ellipticc</span>
                    </div>
                </div>
            </div>

            {/* Actions (Visible on Hover / Focus) */}
            <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-background/80 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShare(item.id, item.name, item.type);
                            }}
                        >
                            <IconShare3 className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p className="text-[10px] font-medium">Share</p>
                    </TooltipContent>
                </Tooltip>

                <FileActionsMenu
                    item={item}
                    onPreview={onPreview}
                    onShare={onShare}
                    onStar={onStar}
                    onMoveToFolder={onMoveToFolder}
                    onCopy={onCopy}
                    onRename={onRename}
                    onDetails={onDetails}
                    onMoveToTrash={onMoveToTrash}
                    trigger={
                        <div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-background/80 rounded-full">
                                        <span className="sr-only">Actions</span>
                                        <IconDotsVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-[10px] font-medium">More actions</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    }
                />
            </div>
        </div>
    );
};
