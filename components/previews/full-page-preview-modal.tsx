"use client"

import React, { useState, useEffect, useCallback } from "react"
import { IconX as X, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconDownload as Download, IconInfoCircle as Info, IconShare as Share2, IconFileUnknown } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AudioPreview } from "./audio-preview"
import { VideoPreview } from "./video-preview"
import { TextPreview } from "./text-preview"
import { ImagePreview } from "./image-preview"
import { PdfPreview } from "./pdf-preview"

import { FileIcon } from "../file-icon"
import { DownloadProgress } from "@/lib/download"
import { formatFileSize } from "@/lib/utils"

// Define the FileItem interface based on what's passed from files-table
export interface PreviewFileItem {
    id: string
    name: string
    type: 'file' | 'folder'
    mimeType?: string
    size?: number
    blobUrl?: string
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
    currentIndex?: number
    totalItems?: number
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
    hasNext,
    currentIndex,
    totalItems
}: FullPagePreviewModalProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)

    // Handle body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    // Reset state when file changes
    useEffect(() => {
        if (file?.id) {
            setIsLoading(true)
            setDownloadProgress(null)
        }
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
        // Size Limit Check (100MB)
        const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100 MB
        if (file.size && file.size > MAX_PREVIEW_SIZE) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-5">
                    <Info className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-2">File too large to preview</p>
                    <p className="text-sm mb-6 max-w-md text-center text-muted-foreground/80">
                        This file is <span className="font-medium text-foreground">{formatFileSize(file.size)}</span>.
                        Previews are limited to 100 MB. Please download the file to view it.
                    </p>
                    <Button onClick={() => onDownload(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download File
                    </Button>
                </div>
            )
        }

        if (!file.mimeType) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-5">
                    <IconFileUnknown className="h-20 w-20 mb-6 opacity-40 text-muted-foreground" />
                    <p className="text-2xl font-bold mb-8 text-center">Preview for this file type is not supported</p>
                    <Button onClick={() => onDownload(file)} size="lg">
                        <Download className="mr-2 h-5 w-5" />
                        Download File
                    </Button>
                </div>
            )
        }

        const commonProps = {
            key: file.id, // Critical: Forces component remount, cancelling previous effects
            fileId: file.id,
            filename: file.name,
            fileName: file.name,
            mimetype: file.mimeType,
            mimeType: file.mimeType,
            fileSize: file.size,
            onProgress: handleProgress,
            onError: handleError,
            isLoading,
            setIsLoading,
            blobUrl: file.blobUrl
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-5">
                <IconFileUnknown className="h-20 w-20 mb-6 opacity-40 text-muted-foreground" />
                <p className="text-2xl font-bold mb-8 text-center">Preview for this file type is not supported</p>
                <Button onClick={() => onDownload(file)} size="lg">
                    <Download className="mr-2 h-5 w-5" />
                    Download File
                </Button>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden animate-in fade-in-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b bg-background sticky top-0 z-10 shrink-0">

                {/* Left: File Info */}
                <div className="flex items-center gap-3 min-w-0 w-1/4">
                    <div className="p-2 bg-muted rounded-md shrink-0">
                        <FileIcon className="h-5 w-5" filename={file.name} mimeType={file.mimeType} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate block" title={file.name}>
                            {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {file.size ? formatFileSize(file.size) : ''}
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
                    <span className="text-sm text-muted-foreground min-w-[100px] text-center select-none">
                        {(currentIndex !== undefined && totalItems) ? (
                            <>
                                <span className="font-bold text-foreground">{currentIndex + 1}</span> of <span className="font-bold text-foreground">{totalItems}</span> items
                            </>
                        ) : (
                            'Navigate'
                        )}
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
            <div className="flex-1 overflow-hidden relative bg-background flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    {renderPreviewContent()}
                </div>
            </div>
        </div>
    )
}
