"use client"

import React, { useState, useEffect } from "react"
import { IconPhoto, IconPlayerPlay, IconLoader2, IconCircle, IconCircleCheckFilled } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { decryptData } from "@/lib/crypto"
import { unwrapCEK, DownloadEncryption } from "@/lib/download"
import { keyManager } from "@/lib/key-manager"
import { format, parseISO } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"

export interface GalleryItemProps {
    item: any
    isSelected: boolean
    isSelectionMode: boolean
    onSelect: () => void
    onPreview: () => void
    viewMode: 'comfortable' | 'compact'
    index: number
}

export function GalleryItem({ item, isSelected, isSelectionMode, onSelect, onPreview, viewMode, index }: GalleryItemProps) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
    const [isDecrypting, setIsDecrypting] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

    useEffect(() => {
        let isMounted = true

        async function loadThumbnail() {
            if (!item.thumbnailPath) return

            // If we already have a URL or failed too many times, skip
            if (thumbnailUrl || hasError) return

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
                    setThumbnailUrl(url)
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
        }
    }, [item.id, item.thumbnailPath, retryCount, hasError, thumbnailUrl, item.encryption])

    useEffect(() => {
        return () => {
            if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl)
        }
    }, [thumbnailUrl])

    const isVideo = item.mimeType?.startsWith('video/')

    // Handle click based on mode
    const handleClick = (e: React.MouseEvent) => {
        // If holding shift or ctrl/cmd, always treat as selection
        if (e.shiftKey || e.ctrlKey || e.metaKey || isSelectionMode) {
            e.stopPropagation()
            e.preventDefault()
            onSelect()
            return
        }

        // Otherwise open preview
        onPreview()
    }

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        onSelect()
    }

    return (
        <div
            className={`
                group relative bg-muted rounded-xl overflow-hidden cursor-pointer select-none
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
                    className={`
                        w-full h-full object-cover transition-transform duration-500 z-10 relative
                        ${isSelected ? 'scale-105' : 'group-hover:scale-105'}
                    `}
                    loading="lazy"
                />
            )}

            {/* Video Indicator */}
            {isVideo && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm rounded-md text-[10px] text-white font-medium z-20 flex items-center gap-1">
                    <IconPlayerPlay className="h-3 w-3 fill-current" />
                    {item.duration ? (
                        <span>
                            {Math.floor(item.duration / 60)}:{Math.floor(item.duration % 60).toString().padStart(2, '0')}
                        </span>
                    ) : null}
                </div>
            )}

            {/* Selection Checkbox Overlay */}
            <div
                className={`
                    absolute top-2 left-2 z-30 transition-all duration-200
                    ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}
                `}
                onClick={handleCheckboxClick}
            >
                {isSelected ? (
                    <IconCircleCheckFilled className="h-6 w-6 text-primary bg-white rounded-full" />
                ) : (
                    <div className="bg-black/20 hover:bg-black/40 backdrop-blur-[1px] rounded-full p-0.5 transition-colors">
                        <IconCircle className="h-5 w-5 text-white/80" stroke={1.5} />
                    </div>
                )}
            </div>

            {/* Info Overlay (Gradient) */}
            <div className={`
                absolute inset-x-0 bottom-0 p-3 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent 
                transition-opacity duration-200 z-20
                ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}
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
