"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { IconFile, IconFolder, IconCalendar, IconUser, IconDatabase } from "@tabler/icons-react"
import { formatFileSize } from "@/lib/utils"

interface FileDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fileName: string
    fileSize: number
    fileType?: string
    createdAt?: string
    ownerName?: string
    isFolder?: boolean
}

export function FileDetailsDialog({
    open,
    onOpenChange,
    fileName,
    fileSize,
    fileType,
    createdAt,
    ownerName,
    isFolder
}: FileDetailsDialogProps) {

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>File Details</DialogTitle>
                    <DialogDescription>
                        Information about this shared content.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            {isFolder ? (
                                <IconFolder className="h-6 w-6 text-primary" />
                            ) : (
                                <IconFile className="h-6 w-6 text-primary" />
                            )}
                        </div>
                        <div className="grid gap-1">
                            <p className="font-medium leading-none break-all line-clamp-2">{fileName}</p>
                            <p className="text-sm text-muted-foreground">{isFolder ? 'Folder' : fileType || 'File'}</p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="grid grid-cols-[24px_1fr] items-center gap-4">
                            <IconDatabase className="h-4 w-4 text-muted-foreground" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium leading-none">Size</p>
                                <p className="text-sm text-muted-foreground">{isFolder ? '-' : formatFileSize(fileSize)}</p>
                            </div>
                        </div>

                        {createdAt && (
                            <div className="grid grid-cols-[24px_1fr] items-center gap-4">
                                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Created</p>
                                    <p className="text-sm text-muted-foreground">{formatDate(createdAt)}</p>
                                </div>
                            </div>
                        )}

                        {ownerName && (
                            <div className="grid grid-cols-[24px_1fr] items-center gap-4">
                                <IconUser className="h-4 w-4 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Shared by</p>
                                    <p className="text-sm text-muted-foreground">{ownerName}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
