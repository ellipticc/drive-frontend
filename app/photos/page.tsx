"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
    IconPhoto,
    IconPlayerPlay,
    IconLoader2,
    IconCalendar,
    IconLayoutGrid,
    IconColumns3,
    IconRefresh
} from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { decryptData, decryptFilename } from "@/lib/crypto"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FullPagePreviewModal, PreviewFileItem } from "@/components/previews/full-page-preview-modal"
import { downloadFileToBrowser, unwrapCEK } from "@/lib/download"
import { toast } from "sonner"
import { keyManager } from "@/lib/key-manager"
import { masterKeyManager } from "@/lib/master-key"
import { SiteHeader } from "@/components/layout/header/site-header"

interface MediaItem {
    id: string
    filename: string // Plaintext filename after decryption
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
}

export default function PhotosPage() {
    const [rawItems, setRawItems] = useState<any[]>([])
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable')

    // Preview state
    const [previewFile, setPreviewFile] = useState<PreviewFileItem | null>(null)
    const [previewIndex, setPreviewIndex] = useState(-1)

    const fetchAndDecryptPhotos = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true)
        else setIsLoading(true)

        try {
            const response = await apiClient.getPhotos(100, 0)
            if (response.success && response.data) {
                const raw = response.data;
                setRawItems(raw);

                // Decrypt all filenames
                const masterKey = masterKeyManager.getMasterKey();
                const decryptedItems = await Promise.all(raw.map(async (item: any) => {
                    try {
                        const decryptedName = await decryptFilename(
                            item.encryptedFilename,
                            item.filenameSalt,
                            masterKey
                        );
                        return { ...item, filename: decryptedName };
                    } catch (err) {
                        console.error(`Failed to decrypt filename for ${item.id}:`, err);
                        return { ...item, filename: "Encrypted File" };
                    }
                }));

                setMediaItems(decryptedItems);
            } else {
                toast.error("Failed to fetch photos")
            }
        } catch (error) {
            console.error("Fetch photos error:", error)
            toast.error("An error occurred while fetching photos")
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [])

    useEffect(() => {
        fetchAndDecryptPhotos()
    }, [fetchAndDecryptPhotos])

    const filteredItems = useMemo(() => {
        return mediaItems.filter(item =>
            item.filename.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [mediaItems, searchQuery])

    // Group items by date
    const groupedItems = useMemo(() => {
        const grouped: { [key: string]: MediaItem[] } = {}
        filteredItems.forEach(item => {
            const date = format(parseISO(item.createdAt), 'yyyy-MM-dd')
            if (!grouped[date]) {
                grouped[date] = []
            }
            grouped[date].push(item)
        })
        return grouped
    }, [filteredItems])

    const sortedDates = useMemo(() => {
        return Object.keys(groupedItems).sort((a, b) => b.localeCompare(a))
    }, [groupedItems])

    const handlePreview = (item: MediaItem, index: number) => {
        setPreviewFile({
            id: item.id,
            name: item.filename,
            type: 'file',
            mimeType: item.mimeType,
            size: item.size
        })
        setPreviewIndex(index)
    }

    const handleNavigate = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev' ? previewIndex - 1 : previewIndex + 1
        if (newIndex >= 0 && newIndex < filteredItems.length) {
            const newItem = filteredItems[newIndex]
            handlePreview(newItem, newIndex)
        }
    }

    const handleDownload = async (file: PreviewFileItem) => {
        try {
            await downloadFileToBrowser(file.id)
            toast.success("Download started")
        } catch (error) {
            console.error("Download error:", error)
            toast.error("Failed to start download")
        }
    }

    const formatDateHeader = (dateStr: string) => {
        const date = parseISO(dateStr)
        if (isToday(date)) return "Today"
        if (isYesterday(date)) return "Yesterday"
        return format(date, 'MMMM d, yyyy')
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <SiteHeader onSearch={setSearchQuery} />

            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Secondary Header / Controls */}
                <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-background/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-semibold tracking-tight">Photos & Videos</h1>
                        <div className="h-4 w-[1px] bg-border mx-2" />
                        <p className="text-sm text-muted-foreground">
                            {mediaItems.length} items securely stored
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => fetchAndDecryptPhotos(true)}
                            disabled={isRefreshing}
                        >
                            <IconRefresh className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
                            <Button
                                variant={viewMode === 'comfortable' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setViewMode('comfortable')}
                            >
                                <IconLayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                                Comfortable
                            </Button>
                            <Button
                                variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setViewMode('compact')}
                            >
                                <IconColumns3 className="h-3.5 w-3.5 mr-1.5" />
                                Compact
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="space-y-8 flex flex-col items-center justify-center h-64">
                            <IconLoader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground animate-pulse">Decrypting your secure media gallery...</p>
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-20">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                <IconPhoto className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">No photos or videos yet</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">
                                Upload your first photo or video to see it here in a beautiful grid.
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <p className="text-muted-foreground">No media matches your search.</p>
                        </div>
                    ) : (
                        <div className="space-y-12 pb-20">
                            {sortedDates.map(date => (
                                <section key={date} className="space-y-4">
                                    <div className="flex items-center gap-2 sticky top-[-24px] bg-background/95 backdrop-blur py-3 z-10 border-b mb-4">
                                        <IconCalendar className="h-4 w-4 text-primary" />
                                        <h2 className="font-semibold text-base">{formatDateHeader(date)}</h2>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {groupedItems[date].length} items
                                        </span>
                                    </div>
                                    <div className={
                                        viewMode === 'comfortable'
                                            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6"
                                            : "grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11 gap-2"
                                    }>
                                        {groupedItems[date].map((item) => (
                                            <MediaCard
                                                key={item.id}
                                                item={item}
                                                onClick={() => handlePreview(item, filteredItems.indexOf(item))}
                                                viewMode={viewMode}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Modal */}
            <FullPagePreviewModal
                isOpen={!!previewFile}
                file={previewFile}
                onClose={() => setPreviewFile(null)}
                onNavigate={handleNavigate}
                onDownload={handleDownload}
                hasPrev={previewIndex > 0}
                hasNext={previewIndex < filteredItems.length - 1}
                currentIndex={previewIndex}
                totalItems={filteredItems.length}
            />
        </div>
    )
}

function MediaCard({ item, onClick, viewMode }: { item: MediaItem, onClick: () => void, viewMode: 'comfortable' | 'compact' }) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
    const [isDecrypting, setIsDecrypting] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

    useEffect(() => {
        let isMounted = true

        async function loadThumbnail() {
            if (!item.thumbnailPath) return

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
                } as any, userKeys.keypairs)

                const decryptedBytes = decryptData(encryptedPart, cek, noncePart)
                const decryptedBlob = new Blob([decryptedBytes.buffer.slice(decryptedBytes.byteOffset, decryptedBytes.byteOffset + decryptedBytes.byteLength) as ArrayBuffer], { type: 'image/jpeg' })

                if (isMounted) {
                    const url = URL.createObjectURL(decryptedBlob)
                    setThumbnailUrl(url)
                }
            } catch (err) {
                console.error("Thumbnail error:", err)
                if (retryCount < 2 && isMounted) {
                    setTimeout(() => setRetryCount(prev => prev + 1), 1000)
                }
            } finally {
                if (isMounted) setIsDecrypting(false)
            }
        }

        loadThumbnail()

        return () => {
            isMounted = false
        }
    }, [item.id, item.thumbnailPath, retryCount])

    useEffect(() => {
        return () => {
            if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl)
        }
    }, [thumbnailUrl])

    const isVideo = item.mimeType.startsWith('video/')

    return (
        <div
            className={`
                group relative bg-muted rounded-xl overflow-hidden cursor-pointer 
                transition-all duration-300 hover:ring-2 hover:ring-primary hover:shadow-xl
                ${viewMode === 'comfortable' ? 'aspect-square' : 'aspect-square'}
            `}
            onClick={onClick}
        >
            {thumbnailUrl ? (
                <div className="relative w-full h-full">
                    <img
                        src={thumbnailUrl}
                        alt={item.filename}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 transform transition-transform group-hover:scale-110">
                                <IconPlayerPlay className="h-5 w-5 text-white fill-white" />
                            </div>
                        </div>
                    )}
                    {isVideo && item.duration && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white font-medium">
                            {Math.floor(item.duration / 60)}:{Math.floor(item.duration % 60).toString().padStart(2, '0')}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/30 bg-muted/50">
                    {isDecrypting ? (
                        <IconLoader2 className="h-6 w-6 animate-spin text-primary/40" />
                    ) : (
                        <>
                            <IconPhoto className="h-10 w-10" />
                            {viewMode === 'comfortable' && <span className="text-[10px] font-medium">Loading...</span>}
                        </>
                    )}
                </div>
            )}

            {/* Overlay */}
            <div className={`
                absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent 
                transition-opacity duration-300
                ${viewMode === 'comfortable' ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}
            `}>
                <p className="text-white text-[11px] font-medium truncate">
                    {item.filename}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                    <p className="text-white/60 text-[9px]">
                        {format(parseISO(item.createdAt), 'HH:mm')}
                    </p>
                    <p className="text-white/60 text-[9px]">
                        {format(parseISO(item.createdAt), 'MMM d')}
                    </p>
                </div>
            </div>
        </div>
    )
}
