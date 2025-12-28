"use client"

import React, { useState, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Download, Info, Share2, File as FileIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AudioPreview } from "./audio-preview"
import { VideoPreview } from "./video-preview"
import { TextPreview } from "./text-preview"
import { ImagePreview } from "./image-preview"
import { PdfPreview } from "./pdf-preview"
import { DownloadProgress } from "@/lib/download"
import { truncateFilename } from "@/lib/utils"

// Define the FileItem interface based on what's passed from files-table
export interface PreviewFileItem {
    id: string
    name: string
    type: 'file' | 'folder'
    mimeType?: string
    size?: number
    // Add other fields if needed for context
}

interface FullPagePreviewModalProps {
    isOpen: boolean
    file: PreviewFileItem | null
    onClose: () => void
    onNavigate: (direction: 'prev' | 'next') => void
    onDownload: (file: PreviewFileItem) => void
    onShare?: (file: PreviewFileItem) => void
    onDetails?: (file: PreviewFileItem) => void
    hasPrev: boolean
    hasNext: boolean
}

export function FullPagePreviewModal({
    isOpen,
    file,
    onClose,
    onNavigate,
    onDownload,
    onShare,
    onDetails,
    hasPrev,
    hasNext
}: FullPagePreviewModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)

    // Reset state when file changes
    useEffect(() => {
        setIsLoading(false)
        setDownloadProgress(null)
    }, [file?.id])

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && hasPrev) {
                onNavigate('prev')
            } else if (e.key === 'ArrowRight' && hasNext) {
                onNavigate('next')
            } else if (e.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, hasPrev, hasNext, onNavigate, onClose])

    const handleProgress = useCallback((progress: DownloadProgress) => {
        setDownloadProgress(progress)
    }, [])

    const handleError = useCallback((error: string) => {
        console.error("Preview error:", error)
        setIsLoading(false)
    }, [])

    if (!isOpen || !file) return null

    const renderPreviewContent = () => {
        if (!file.mimeType) return <div className="text-muted-foreground">Preview not available</div>

        const commonProps = {
            fileId: file.id,
            filename: file.name, // Note: components expect 'filename' or 'fileName' depending on implementation, checking standard
            fileName: file.name,
            mimetype: file.mimeType,
            mimeType: file.mimeType,
            fileSize: file.size,
            onProgress: handleProgress,
            onError: handleError,
            isLoading,
            setIsLoading
        }

        if (file.mimeType.startsWith('image/')) {
            return <ImagePreview {...commonProps} />
        }
        if (file.mimeType.startsWith('audio/')) {
            return <AudioPreview {...commonProps} />
        }
        if (file.mimeType.startsWith('video/')) {
            return <VideoPreview {...commonProps} />
        }
        if (file.mimeType === 'application/pdf') {
            return <PdfPreview {...commonProps} />
        }
        if (
            file.mimeType.startsWith('text/') ||
            file.mimeType.includes('json') ||
            file.mimeType.includes('javascript') ||
            file.mimeType.includes('xml') ||
            file.mimeType.includes('css')
        ) {
            return <TextPreview {...commonProps} />
        }

        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="mb-2">No preview available</p>
                <Button variant="outline" onClick={() => onDownload(file)}>Download File</Button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10">

                {/* Left: File Info */}
                <div className="flex items-center gap-3 min-w-0 w-1/4">
                    <div className="p-2 bg-muted rounded-md shrink-0">
                        <FileIcon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate block" title={file.name}>
                            {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                        </span>
                    </div>
                </div>

                {/* Center: Pagination */}
                <div className="flex items-center justify-center gap-2 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onNavigate('prev')}
                        disabled={!hasPrev}
                        className="rounded-full"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <span className="text-sm text-muted-foreground w-16 text-center select-none">
                        Navigate
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onNavigate('next')}
                        disabled={!hasNext}
                        className="rounded-full"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </Button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2 w-1/4">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onDownload(file)}>
                                <Download className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                    </Tooltip>

                    {onShare && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => onShare(file)}>
                                    <Share2 className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Share</TooltipContent>
                        </Tooltip>
                    )}

                    {onDetails && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => onDetails(file)}>
                                    <Info className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Details</TooltipContent>
                        </Tooltip>
                    )}

                    <div className="w-px h-6 bg-border mx-2" />

                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/10 hover:text-destructive">
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative bg-black/5 flex items-center justify-center p-4">
                <div className="w-full h-full flex items-center justify-center max-w-7xl mx-auto shadow-2xl bg-white rounded-lg overflow-hidden border">
                    {renderPreviewContent()}
                </div>
            </div>
        </div>
    )
}
