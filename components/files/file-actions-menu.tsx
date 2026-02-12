import React from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
    IconEye,
    IconShare3,
    IconFolder,
    IconCopy,
    IconEdit,
    IconInfoCircle,
    IconTrash,
} from "@tabler/icons-react";
import { DotsVertical } from "@untitledui/icons"; // Using the one from files-table if possible, or tabler if preferred. FilesTable uses @untitledui/icons DotsVertical for the trigger.

export interface FileActionsMenuProps {
    item: {
        id: string;
        name: string;
        type: "file" | "folder";
        mimeType?: string;

    };
    onPreview?: (id: string, name: string, mimeType: string) => void;
    onShare: (id: string, name: string, type: "file" | "folder") => void;
    onMoveToFolder: (id: string, name: string, type: "file" | "folder") => void;
    onCopy: (id: string, name: string, type: "file" | "folder") => void;
    onRename: (id: string, name: string, type: "file" | "folder") => void;
    onDetails: (id: string, name: string, type: "file" | "folder") => void;
    onMoveToTrash: (id: string, name: string, type: "file" | "folder") => void;
    trigger?: React.ReactNode;
    align?: "start" | "end" | "center";
}

export const FileActionsMenu = ({
    item,
    onPreview,
    onShare,

    onMoveToFolder,
    onCopy,
    onRename,
    onDetails,
    onMoveToTrash,
    trigger,
    align = "end",
}: FileActionsMenuProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {trigger || (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <DotsVertical className="h-4 w-4" />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-48">
                {item.type === "file" && onPreview && (
                    <DropdownMenuItem onClick={() => onPreview(item.id, item.name, item.mimeType || "")}>
                        <IconEye className="h-4 w-4 mr-2" />
                        Preview
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onShare(item.id, item.name, item.type)}>
                    <IconShare3 className="h-4 w-4 mr-2" />
                    Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMoveToFolder(item.id, item.name, item.type)}>
                    <IconFolder className="h-4 w-4 mr-2" />
                    Move to folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopy(item.id, item.name, item.type)}>
                    <IconCopy className="h-4 w-4 mr-2" />
                    Copy to...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(item.id, item.name, item.type)}>
                    <IconEdit className="h-4 w-4 mr-2" />
                    Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDetails(item.id, item.name, item.type)}>
                    <IconInfoCircle className="h-4 w-4 mr-2" />
                    Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMoveToTrash(item.id, item.name, item.type)} variant="destructive">
                    <IconTrash className="h-4 w-4 mr-2" />
                    Move to trash
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
