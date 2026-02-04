"use client"

import React, { useState, useEffect } from "react"

// Global cache for thumbnails to prevent re-fetching on grid resize/zoom
const thumbnailCache = new Map<string, { url: string, refCount: number, timeout?: NodeJS.Timeout }>();


import { IconPhoto, IconPlayerPlay, IconLoader2, IconSquare, IconSquareCheckFilled, IconDotsVertical, IconDownload, IconTrash, IconShare, IconFolderSymlink, IconCopy, IconStar, IconPencil, IconFolderPlus } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { decryptData } from "@/lib/crypto"
import { unwrapCEK, DownloadEncryption } from "@/lib/download"
import { keyManager } from "@/lib/key-manager"
import { format, parseISO } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tag } from "@/lib/api"

interface MediaItem {
    id: string
    encryptedFilename: string
    filenameSalt: string
    mimeType: string
    size: number
    createdAt: string
    thumbnailPath?: string
    width?: number
    height?: number
    duration?: number
    encryption: {
        iv: string
        salt: string
        wrappedCek: string
        fileNoncePrefix: string
        cekNonce: string
        kyberCiphertext: string
        nonceWrapKyber: string
    }
    tags?: Tag[]
    isStarred?: boolean
    filename: string // Plaintext filename after decryption
}

export interface GalleryItemProps {
    item: MediaItem
    isSelected: boolean
    isSelectionMode: boolean
    onSelect: (rangeSelect: boolean) => void
    onPreview: () => void
    viewMode: 'comfortable' | 'compact'
    index: number
    onAction: (action: string, item: MediaItem) => void
}

export function GalleryItem({ item, isSelected, isSelectionMode, onSelect, onPreview, viewMode, onAction }: GalleryItemProps) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
    const [isDecrypting, setIsDecrypting] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

    // Local context menu open flag to persist hover effect when menu is open
    const [menuOpen, setMenuOpen] = useState(false)

    // Intersection observer for lazy loading
    const [setRef, isIntersecting] = useIntersectionObserver({
        threshold: 0.1,
        rootMargin: '100px', // Load 100px before entering viewport
        triggerOnce: true,
    })

    useEffect(() => {
        // Only load thumbnail when element intersects viewport
        if (!isIntersecting) return

        let isMounted = true

        async function loadThumbnail() {
            if (!item.thumbnailPath) return

            // Check global cache first
            const cached = thumbnailCache.get(item.id);
            if (cached) {
                if (cached.timeout) {
                    clearTimeout(cached.timeout);
                    cached.timeout = undefined;
                }
                cached.refCount++;
                setThumbnailUrl(cached.url);
                return;
            }

            // If we already fail too many times, skip
            if (hasError) return

            setIsDecrypting(true)
            try {
                // Get presigned URL for encrypted thumbnail
                const response = await apiClient.getThumbnailUrl(item.id)
                if (!response.success || !response.data?.url) {
                    throw new Error("Failed to get thumbnail URL")
                }

                // Download encrypted thumbnail
                const thumbResponse = await fetch(response.data.url)
                if (!thumbResponse.ok) throw new Error("Failed to download thumbnail")

                const encryptedText = await thumbResponse.text()

                // Parse "encryptedData:nonce"
                const [encryptedPart, noncePart] = encryptedText.split(':')
                if (!encryptedPart || !noncePart) throw new Error("Invalid thumbnail format")

                // Get User Keys
                const userKeys = await keyManager.getUserKeys()

                // Decrypt CEK
                const cek = await unwrapCEK({
                    wrappedCek: item.encryption.wrappedCek,
                    cekNonce: item.encryption.cekNonce,
                    kyberCiphertext: item.encryption.kyberCiphertext,
                    nonceWrapKyber: item.encryption.nonceWrapKyber,
                    algorithm: 'v3-hybrid-pqc',
                    version: '3.0'
                } as DownloadEncryption, userKeys.keypairs)

                const decryptedBytes = decryptData(encryptedPart, cek, noncePart)
                const decryptedBlob = new Blob([decryptedBytes.buffer.slice(decryptedBytes.byteOffset, decryptedBytes.byteOffset + decryptedBytes.byteLength) as ArrayBuffer], { type: 'image/jpeg' })

                if (isMounted) {
                    const url = URL.createObjectURL(decryptedBlob)

                    // Add to cache
                    const existing = thumbnailCache.get(item.id);
                    if (existing) {
                        // Race condition handled
                        if (existing.timeout) clearTimeout(existing.timeout);
                        existing.refCount++;
                        setThumbnailUrl(existing.url);
                    } else {
                        thumbnailCache.set(item.id, { url, refCount: 1 });
                        setThumbnailUrl(url);
                    }
                }
            } catch (err) {
                console.error("Thumbnail error:", err)
                if (retryCount < 2 && isMounted) {
                    // Retry with exponential backoff
                    setTimeout(() => setRetryCount(prev => prev + 1), 1000 * (retryCount + 1))
                } else if (isMounted) {
                    setHasError(true)
                }
            } finally {
                if (isMounted) setIsDecrypting(false)
            }
        }

        loadThumbnail()

        return () => {
            isMounted = false
            // Handle cache ref counting on unmount
            const entry = thumbnailCache.get(item.id);
            if (entry) {
                entry.refCount--;
                if (entry.refCount <= 0) {
                    // Delay cleanup to allow for remounting (e.g. grid resize)
                    entry.timeout = setTimeout(() => {
                        const current = thumbnailCache.get(item.id);
                        if (current && current.refCount <= 0) {
                            URL.revokeObjectURL(current.url);
                            thumbnailCache.delete(item.id);
                        }
                    }, 10000); // 10 seconds cache retention after unmount
                }
            }
        }
    }, [item.id, item.thumbnailPath, retryCount, hasError, item.encryption, isIntersecting])


    const isVideo = item.mimeType?.startsWith('video/')

    // Handle click based on mode
    const handleClick = (e: React.MouseEvent) => {
        // If holding shift or ctrl/cmd, always treat as selection
        if (e.shiftKey || e.ctrlKey || e.metaKey || isSelectionMode) {
            e.stopPropagation()
            e.preventDefault()
            // Range select when holding shift, otherwise normal toggle
            onSelect(e.shiftKey)
            return
        }

        // Otherwise open preview
        onPreview()
    }

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        // Checkbox is a normal toggle (no range)
        onSelect(false)
    }

    return (
        <div
            ref={setRef}
            className={`
                group relative bg-muted rounded-2xl overflow-hidden cursor-pointer select-none
                transition-all duration-200 
                ${isSelected ? 'ring-2 ring-primary shadow-md scale-[0.98]' : 'hover:shadow-lg'}
                ${viewMode === 'comfortable' ? 'aspect-square' : 'aspect-square'}
            `}
            onClick={handleClick}
        >
            {/* Loading / Placeholder State */}
            {!thumbnailUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-0">
                    {isDecrypting ? (
                        <IconLoader2 className="h-6 w-6 animate-spin text-primary/20" />
                    ) : hasError ? (
                        <IconPhoto className="h-8 w-8 text-muted-foreground/20" />
                    ) : (
                        <Skeleton className="w-full h-full" />
                    )}
                </div>
            )}

            {/* Image */}
            {thumbnailUrl && (
                <img
                    src={thumbnailUrl}
                    alt={item.filename}
                    className="w-full h-full object-cover z-10 relative rounded-2xl"
                    loading="lazy"
                />
            )}

            {/* Video Indicator - Moved to Bottom Right */}
            {isVideo && (
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-[2px] rounded-sm text-[10px] text-white/90 font-medium z-20 flex items-center gap-1 shadow-sm">
                    <IconPlayerPlay className="h-3 w-3 fill-current" />
                    {item.duration ? (
                        <span>
                            {Math.floor(item.duration / 60)}:{Math.floor(item.duration % 60).toString().padStart(2, '0')}
                        </span>
                    ) : null}
                </div>
            )}

            {/* Star Indicator */}
            {item.isStarred && (
                <div className="absolute top-2 left-10 z-20 text-yellow-400 drop-shadow-md">
                    <IconStar className="h-5 w-5 fill-yellow-400 text-yellow-500" />
                </div>
            )}

            {/* Context Menu - Top Right */}
            <div className={`absolute top-2 right-2 z-30 transition-opacity ${isSelectionMode ? 'hidden' : ''}`}>
                <DropdownMenu onOpenChange={(open) => setMenuOpen(open)}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 text-white hover:text-white backdrop-blur-[1px]" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <IconDotsVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom" className="w-48">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('preview', item) }}>
                            <IconPhoto className="mr-2 h-4 w-4" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('download', item) }}>
                            <IconDownload className="mr-2 h-4 w-4" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('share', item) }}>
                            <IconShare className="mr-2 h-4 w-4" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('star', item) }}>
                            <IconStar className="mr-2 h-4 w-4" /> Add to Favorites
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('move', item) }}>
                            <IconFolderSymlink className="mr-2 h-4 w-4" /> Move to...
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('copy', item) }}>
                            <IconCopy className="mr-2 h-4 w-4" /> Make a copy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('rename', item) }}>
                            <IconPencil className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('addToSpace', item) }}>
                            <IconFolderPlus className="mr-2 h-4 w-4" /> Add to space
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); onAction('delete', item) }}>
                            <IconTrash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Selection Checkbox Overlay */}
            <div
                className={`
                    absolute top-2 left-2 z-30 transition-all duration-200
                    ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}
                `}
                onClick={handleCheckboxClick}
            >
                {isSelected ? (
                    <IconSquareCheckFilled className="h-6 w-6 text-primary bg-background rounded-sm" />
                ) : (
                    <div className="text-white/70 hover:text-white transition-colors drop-shadow-md">
                        <IconSquare className="h-6 w-6" stroke={2} />
                    </div>
                )}
            </div>

            {/* Info Overlay (Gradient) */}
            <div className={`
                absolute inset-x-0 bottom-0 p-3 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent 
                transition-opacity duration-200 z-20
                ${isSelected ? 'opacity-0' : (menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
            `}>
                <p className="text-white text-[11px] font-medium truncate drop-shadow-sm">
                    {item.filename}
                </p>
                <p className="text-white/70 text-[10px] drop-shadow-sm">
                    {format(parseISO(item.createdAt), 'MMM d, yyyy')}
                </p>
            </div>

            {/* Selected Overlay Tint */}
            {isSelected && (
                <div className="absolute inset-0 bg-primary/10 z-10 pointer-events-none" />
            )}
        </div>
    )
}
