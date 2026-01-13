"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { IconPhoto, IconLoader2, IconRefresh } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { masterKeyManager } from "@/lib/master-key"
import { SiteHeader } from "@/components/layout/header/site-header"
import { useUser } from "@/components/user-context"
import { Tag } from "@/lib/api"
import { FullPagePreviewModal, PreviewFileItem } from "@/components/previews/full-page-preview-modal"
import { downloadFileToBrowser } from "@/lib/download"
import { useGallerySelection } from "./hooks/use-gallery-selection"
import { GalleryGrid } from "./components/gallery-grid"
import { GalleryToolbar } from "./components/gallery-toolbar"
import { SelectionBar } from "./components/selection-bar"
import { Button } from "@/components/ui/button"

interface RawPhotoItem {
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
}

interface MediaItem extends RawPhotoItem {
    filename: string // Plaintext filename after decryption
}

export default function PhotosPage() { // Renamed from Page to PhotosPage for clarity, though default export is what matters
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { deviceQuota } = useUser()
    const isFreePlan = deviceQuota?.planName === 'Free'

    // Data State
    const [rawItems, setRawItems] = useState<unknown[]>([])
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable')

    // Preview State
    const [previewFile, setPreviewFile] = useState<PreviewFileItem | null>(null)
    const [previewIndex, setPreviewIndex] = useState(-1)

    // Sync search param from URL
    useEffect(() => {
        const q = searchParams.get('q');
        setSearchQuery(q || "");
    }, [searchParams]);

    const handleSearch = (query: string) => {
        setSearchQuery(query)
        const params = new URLSearchParams(searchParams.toString())
        if (query) {
            params.set('q', query)
        } else {
            params.delete('q')
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const fetchAndDecryptPhotos = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true)
        else setIsLoading(true)

        try {
            const response = await apiClient.getPhotos(1000, 0) // Increased limit for gallery
            if (response.success && response.data) {
                const raw = response.data;
                setRawItems(raw);

                // Decrypt all filenames
                const masterKey = masterKeyManager.getMasterKey();
                const decryptedItems = await Promise.all(raw.map(async (item: unknown) => {
                    const photoItem = item as RawPhotoItem;
                    try {
                        const decryptedName = await decryptFilename(
                            photoItem.encryptedFilename,
                            photoItem.filenameSalt,
                            masterKey
                        );
                        // Decrypt tags if needed (simplified for now)
                        return { ...photoItem, filename: decryptedName };
                    } catch (err) {
                        return { ...photoItem, filename: "Encrypted File" };
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

    // Filtering
    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return mediaItems;

        if (query.startsWith('#') && !isFreePlan) {
            // Tag logic would go here
            return mediaItems
        }

        return mediaItems.filter(item =>
            item.filename.toLowerCase().includes(query)
        )
    }, [mediaItems, searchQuery, isFreePlan])

    // Selection Hook
    const {
        selectedIds,
        toggleSelection,
        clearSelection,
        isSelectionMode
    } = useGallerySelection(filteredItems)

    // Grouping
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

    // Handlers
    const handlePreview = (item: MediaItem) => {
        if (isSelectionMode) return; // Don't preview if selecting
        const index = filteredItems.findIndex(i => i.id === item.id)
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
            setPreviewFile({
                id: newItem.id,
                name: newItem.filename,
                type: 'file',
                mimeType: newItem.mimeType,
                size: newItem.size
            })
            setPreviewIndex(newIndex)
        }
    }

    const handleDownload = async (file: PreviewFileItem) => {
        try {
            await downloadFileToBrowser(file.id)
            toast.success("Download started")
        } catch (error) {
            toast.error("Failed to start download")
        }
    }

    // Bulk Actions
    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) return

        const idsToDelete = Array.from(selectedIds)
        // Optimistic update
        const remainingItems = mediaItems.filter(item => !selectedIds.has(item.id))
        setMediaItems(remainingItems)
        clearSelection()

        try {
            // Delete one by one for now (or bulk API if available)
            // Assuming bulk API or promise all
            await Promise.all(idsToDelete.map(id => apiClient.moveFileToTrash(id)))
            toast.success("Items moved to trash")
        } catch (err) {
            toast.error("Failed to delete some items")
            fetchAndDecryptPhotos(true) // Revert/Refresh
        }
    }

    const handleBulkDownload = async () => {
        const idsToDownload = Array.from(selectedIds)
        if (idsToDownload.length > 5 && !confirm(`Download ${idsToDownload.length} files? This might take a moment.`)) return

        toast.message(`Starting download for ${idsToDownload.length} files...`)

        let successCount = 0
        for (const id of idsToDownload) {
            try {
                await downloadFileToBrowser(id)
                successCount++
            } catch (err) {
                console.error(`Failed to download ${id}`, err)
            }
        }

        if (successCount > 0) toast.success(`Downloaded ${successCount} files`)
    }

    return (
        <div className="flex flex-col h-full bg-background relative">
            <SiteHeader onSearch={handleSearch} searchValue={searchQuery} />

            <div className="flex flex-col flex-1 overflow-hidden relative">
                <GalleryToolbar
                    itemCount={filteredItems.length}
                    isRefreshing={isRefreshing}
                    onRefresh={() => fetchAndDecryptPhotos(true)}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />

                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <IconLoader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Decrypting your secure gallery...</p>
                    </div>
                ) : mediaItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <IconPhoto className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No photos yet</h3>
                        <p className="text-muted-foreground max-w-xs mx-auto mb-6">
                            Upload your first photo to see it in your secure gallery.
                        </p>
                        <Button onClick={() => fetchAndDecryptPhotos(true)}>
                            <IconRefresh className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                ) : (
                    <GalleryGrid
                        groupedItems={groupedItems}
                        sortedDates={sortedDates}
                        viewMode={viewMode}
                        selectedIds={selectedIds}
                        isSelectionMode={isSelectionMode}
                        onSelect={(id, range) => toggleSelection(id, true, range)}
                        onPreview={handlePreview}
                    />
                )}

                <SelectionBar
                    selectedCount={selectedIds.size}
                    onClear={clearSelection}
                    onDelete={handleBulkDelete}
                    onDownload={handleBulkDownload}
                // onMove={() => toast.info("Move feature coming soon!")}
                />
            </div>

            {/* Lightbox / Preview */}
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
