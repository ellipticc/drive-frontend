"use client"

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { IconPhoto, IconLoader2, IconDownload, IconTrash, IconFolderSymlink, IconCopy } from "@tabler/icons-react"
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
import { useGlobalUpload } from "@/components/global-upload-context"
import {
    ActionBar,
    ActionBarSelection,
    ActionBarGroup,
    ActionBarItem,
    ActionBarClose,
    ActionBarSeparator,
} from "@/components/ui/action-bar"

// Import Modals
import { MoveToTrashModal } from "@/components/modals/move-to-trash-modal"
import { MoveToFolderModal } from "@/components/modals/move-to-folder-modal"
import { CopyModal } from "@/components/modals/copy-modal"
import { RenameModal } from "@/components/modals/rename-modal"
import { ShareModal } from "@/components/modals/share-modal"
import { SpacePickerModal } from "@/components/modals/space-picker-modal"

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
    isStarred?: boolean
}

interface MediaItem extends RawPhotoItem {
    filename: string // Plaintext filename after decryption
}

function PhotosPageContent() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { user, deviceQuota } = useUser()
    const isFreePlan = (deviceQuota?.planName === 'Free' || !user?.subscription) && user?.plan !== 'pro' && user?.plan !== 'plus' && user?.plan !== 'unlimited';
    const { handleFileUpload, handleFolderUpload } = useGlobalUpload()

    // Data State
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    // View State
    const [viewMode, setViewMode] = useState<'all' | 'photos' | 'videos' | 'starred'>('all')
    const [timeScale, setTimeScale] = useState<'years' | 'months' | 'days'>('days')
    const [zoomLevel, setZoomLevel] = useState(4) // Default column count

    // Preview State
    const [previewFile, setPreviewFile] = useState<PreviewFileItem | null>(null)
    const [previewIndex, setPreviewIndex] = useState(-1)

    // Modal States
    const [isMoveToTrashOpen, setIsMoveToTrashOpen] = useState(false)
    const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false)
    const [isCopyOpen, setIsCopyOpen] = useState(false)
    const [isRenameOpen, setIsRenameOpen] = useState(false)
    const [isShareOpen, setIsShareOpen] = useState(false)
    const [isAddToSpaceOpen, setIsAddToSpaceOpen] = useState(false)

    // Active Item(s) State for Modals
    const [activeItem, setActiveItem] = useState<MediaItem | null>(null)
    const [bulkActionItems, setBulkActionItems] = useState<Array<{ id: string; name: string; type: "file" | "folder" }>>([])


    // Sync search param from URL
    useEffect(() => {
        const q = searchParams.get('q');
        setSearchQuery(q || "");
    }, [searchParams]);

    // Sync preview param from URL (open preview when ?preview=<id> is present)
    useEffect(() => {
        const previewId = searchParams.get('preview');
        if (previewId) {
            const item = mediaItems.find(i => i.id === previewId);
            if (item) {
                handlePreview(item);
            } else {
                // Remove invalid preview param
                const params = new URLSearchParams(searchParams.toString());
                params.delete('preview');
                try {
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                } catch (err) {
                    // ignore
                }
            }
        }
    }, [searchParams, mediaItems, pathname, router]);

    // Check for paid feature usage (Tag Search)
    useEffect(() => {
        if (searchQuery?.startsWith('#') && isFreePlan) {
            toast.error("Advanced Tag Search is a paid feature!", {
                action: {
                    label: "Upgrade",
                    onClick: () => router.push('/pricing')
                }
            });
        }
    }, [searchQuery, isFreePlan, router]);

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
            const response = await apiClient.getPhotos(1000, 0)
            if (response.success && response.data) {
                const raw = response.data;

                const masterKey = masterKeyManager.getMasterKey();
                const decryptedItems = await Promise.all(raw.map(async (item: unknown) => {
                    const photoItem = item as RawPhotoItem;
                    try {
                        const decryptedName = await decryptFilename(
                            photoItem.encryptedFilename,
                            photoItem.filenameSalt,
                            masterKey
                        );
                        return { ...photoItem, filename: decryptedName };
                    } catch {
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
        let items = mediaItems;

        // 1. Search Query
        const query = searchQuery.toLowerCase().trim();
        if (query) {
            if (query.startsWith('#')) {
                // Tag Search - Restricted for free plan
                if (!isFreePlan) {
                    const tagQuery = query.substring(1);
                    if (tagQuery) {
                        items = items.filter(item => item.tags?.some(tag => tag.decryptedName?.toLowerCase().includes(tagQuery)))
                    }
                }
            } else {
                items = items.filter(item => item.filename.toLowerCase().includes(query))
            }
        }

        // 2. View Mode
        if (viewMode === 'photos') {
            items = items.filter(item => item.mimeType.startsWith('image/'))
        } else if (viewMode === 'videos') {
            items = items.filter(item => item.mimeType.startsWith('video/'))
        } else if (viewMode === 'starred') {
            items = items.filter(item => item.isStarred)
        }

        return items;
    }, [mediaItems, searchQuery, viewMode])

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
            let dateKey = '';
            const date = parseISO(item.createdAt);

            if (timeScale === 'years') {
                dateKey = format(date, 'yyyy') // Group by Year
            } else if (timeScale === 'months') {
                dateKey = format(date, 'yyyy-MM') // Group by Month
            } else {
                dateKey = format(date, 'yyyy-MM-dd') // Group by Day
            }

            if (!grouped[dateKey]) {
                grouped[dateKey] = []
            }
            grouped[dateKey].push(item)
        })
        return grouped
    }, [filteredItems, timeScale])

    const sortedDates = useMemo(() => {
        return Object.keys(groupedItems).sort((a, b) => b.localeCompare(a))
    }, [groupedItems])

    // Handlers
    const handlePreview = useCallback((item: MediaItem) => {
        // If in selection mode, clear selection so action bar hides and proceed to preview
        if (isSelectionMode) clearSelection();
        const index = filteredItems.findIndex(i => i.id === item.id)
        setPreviewFile({
            id: item.id,
            name: item.filename,
            type: 'file',
            mimeType: item.mimeType,
            size: item.size
        })
        setPreviewIndex(index)

        // Update URL with preview param so linkable and back-button friendly
        try {
            const params = new URLSearchParams(searchParams.toString());
            params.set('preview', item.id);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        } catch (err) {
            // ignore router errors
        }
    }, [isSelectionMode, filteredItems, clearSelection, searchParams, pathname, router])

    const handleAction = useCallback(async (action: string, item: MediaItem) => {
        setActiveItem(item);
        switch (action) {
            case 'preview':
                handlePreview(item);
                break;
            case 'download':
                try {
                    toast.message(`Downloading ${item.filename}...`)
                    await downloadFileToBrowser(item.id)
                    toast.success("Download complete")
                } catch {
                    toast.error("Download failed")
                }
                break;
            case 'delete':
                setIsMoveToTrashOpen(true);
                break;
            case 'move':
                setBulkActionItems([]); // Clear bulk items
                setIsMoveToFolderOpen(true);
                break;
            case 'copy':
                setBulkActionItems([]); // Clear bulk items
                setIsCopyOpen(true);
                break;
            case 'rename':
                setIsRenameOpen(true);
                break;
            case 'share':
                setIsShareOpen(true);
                break;
            case 'addToSpace':
                setIsAddToSpaceOpen(true);
                break;
            case 'star':
                try {
                    // Optimistic update
                    setMediaItems(prev => prev.map(i =>
                        i.id === item.id ? { ...i, isStarred: !i.isStarred } : i
                    ));

                    if (item.isStarred) {
                        await apiClient.unstarFile(item.id);
                        toast.success("Removed from favorites");
                    } else {
                        await apiClient.starFile(item.id);
                        toast.success("Added to favorites");
                    }
                } catch {
                    toast.error("Failed to update favorite status");
                    // Revert optimistic update
                    setMediaItems(prev => prev.map(i =>
                        i.id === item.id ? { ...i, isStarred: !i.isStarred } : i
                    ));
                }
                break;
        }
    }, [handlePreview])

    const handleNavigate = useCallback((direction: 'prev' | 'next') => {
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

            // Update preview param in URL
            try {
                const params = new URLSearchParams(searchParams.toString());
                params.set('preview', newItem.id);
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            } catch (err) {
                // ignore
            }
        }
    }, [previewIndex, filteredItems, searchParams, pathname, router])

    const handleDownload = useCallback(async (file: PreviewFileItem) => {
        try {
            await downloadFileToBrowser(file.id)
            toast.success("Download started")
        } catch {
            toast.error("Failed to start download")
        }
    }, [])

    // Bulk Actions Setup
    const prepareBulkAction = () => {
        const items = mediaItems.filter(i => selectedIds.has(i.id)).map(i => ({
            id: i.id,
            name: i.filename,
            type: 'file' as const
        }));
        setBulkActionItems(items);
        setActiveItem(null); // Clear single active item
    }

    const handleBulkDelete = () => {
        prepareBulkAction();
        if (selectedIds.size === 0) return;

        if (confirm(`Are you sure you want to move ${selectedIds.size} items to trash?`)) {
            handleBulkMoveToTrashExecute();
            // Clear selection after move so action bar disappears
            clearSelection();
        }
    };

    const handleBulkMoveToTrashExecute = async () => {
        const ids = Array.from(selectedIds);
        setMediaItems(prev => prev.filter(item => !selectedIds.has(item.id)));
        clearSelection();

        let successCount = 0;
        for (const id of ids) {
            try {
                await apiClient.moveFileToTrash(id);
                successCount++;
            } catch (e) {
                console.error(`Failed to trash ${id}`, e);
            }
        }

        if (successCount > 0) toast.success(`Moved ${successCount} items to trash`);
    }

    const handleBulkDownload = async () => {
        const idsToDownload = Array.from(selectedIds);
        if (idsToDownload.length > 5 && !confirm(`Download ${idsToDownload.length} files? This might take a moment.`)) return;

        toast.message(`Starting download for ${idsToDownload.length} files...`);

        // Use loop for now as key management relies on it being ready
        let successCount = 0;
        for (const id of idsToDownload) {
            try {
                await downloadFileToBrowser(id);
                successCount++;
            } catch (err) {
                console.error(`Failed to download ${id}`, err);
            }
        }
        if (successCount > 0) toast.success(`Downloaded ${successCount} files`);
    };

    const handleBulkMove = () => {
        prepareBulkAction();
        setIsMoveToFolderOpen(true);
    };

    const handleBulkCopy = () => {
        prepareBulkAction();
        setIsCopyOpen(true);
    };

    // Modal Callbacks
    const onItemMoved = () => {
        fetchAndDecryptPhotos(true);
        clearSelection();
    };

    const onItemCopied = () => {
        fetchAndDecryptPhotos(true);
        clearSelection();
    }

    const onItemRenamed = (data: any) => {
        // Update local state with new name
        if (activeItem && typeof data.requestedName === 'string') {
            setMediaItems(prev => prev.map(i =>
                i.id === activeItem.id ? { ...i, filename: data.requestedName } : i
            ));
        }
        fetchAndDecryptPhotos(true); // Refresh to be safe with sync
    }

    return (
        <div className="flex min-h-screen w-full flex-col">
            <SiteHeader
                onSearch={handleSearch}
                searchValue={searchQuery}
                onFileUpload={handleFileUpload}
                onFolderUpload={handleFolderUpload}
                sticky
            />

            <main className="flex-1 pt-[var(--header-height)]">
                <div className="flex flex-col bg-background relative md:rounded-2xl">
                    <div className="flex flex-col flex-1 relative">
                        <GalleryToolbar
                            isRefreshing={isRefreshing}
                            onRefresh={() => fetchAndDecryptPhotos(true)}
                            viewMode={viewMode}
                            setViewMode={setViewMode}
                            timeScale={timeScale}
                            setTimeScale={setTimeScale}
                            zoomLevel={zoomLevel} // This is Column Count (default 4)
                            setZoomLevel={setZoomLevel}
                            selectedCount={selectedIds.size}
                            onDownloadSelected={handleBulkDownload}
                            onShareSelected={() => {
                                // Share first selected item
                                const ids = Array.from(selectedIds);
                                if (ids.length === 0) return;
                                const first = mediaItems.find(i => i.id === ids[0]);
                                if (!first) return;
                                setActiveItem(first);
                                setIsShareOpen(true);
                            }}
                            onMoveToTrashSelected={handleBulkDelete}
                            onUpload={() => handleFileUpload('image/*,video/*')}
                            onPreviewSelected={() => {
                                const ids = Array.from(selectedIds);
                                if (ids.length === 0) return;
                                const first = mediaItems.find(i => i.id === ids[0]);
                                if (!first) return;
                                handlePreview(first);
                            }}
                            onDetailsSelected={() => {
                                const ids = Array.from(selectedIds);
                                if (ids.length === 0) return;
                                const first = mediaItems.find(i => i.id === ids[0]);
                                if (!first) return;
                                setActiveItem(first);
                                setIsRenameOpen(true);
                            }}
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
                            </div>
                        ) : (
                            <GalleryGrid
                                groupedItems={groupedItems}
                                sortedDates={sortedDates}
                                zoomLevel={zoomLevel} // Pass column count
                                selectedIds={selectedIds}
                                isSelectionMode={isSelectionMode}
                                onSelect={(id, range) => toggleSelection(id, true, range)}
                                onPreview={handlePreview}
                                onAction={handleAction}
                                timeScale={timeScale}
                            />
                        )}


                    </div>

                    <FullPagePreviewModal
                        isOpen={!!previewFile}
                        file={previewFile}
                        onClose={() => {
                            setPreviewFile(null);
                            try {
                                const params = new URLSearchParams(searchParams.toString());
                                params.delete('preview');
                                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                            } catch (err) {
                                // ignore
                            }
                        }}
                        onNavigate={handleNavigate}
                        onDownload={handleDownload}
                        hasPrev={previewIndex > 0}
                        hasNext={previewIndex < filteredItems.length - 1}
                        currentIndex={previewIndex}
                        totalItems={filteredItems.length}
                    />

                    {/* Global Modals for Actions */}
                    <MoveToTrashModal
                        open={isMoveToTrashOpen}
                        onOpenChange={setIsMoveToTrashOpen}
                        itemId={activeItem?.id}
                        itemName={activeItem?.filename}
                        itemType="file"
                        onItemMoved={() => {
                            if (activeItem) {
                                setMediaItems(prev => prev.filter(i => i.id !== activeItem.id));
                            }
                            // Clear selection so action bar disappears
                            clearSelection();
                            setIsMoveToTrashOpen(false);
                        }}
                    />

                    <MoveToFolderModal
                        open={isMoveToFolderOpen}
                        onOpenChange={setIsMoveToFolderOpen}
                        itemId={activeItem?.id}
                        itemName={activeItem?.filename}
                        itemType="file"
                        items={bulkActionItems.length > 0 ? bulkActionItems : undefined}
                        onItemMoved={onItemMoved}
                    />

                    <CopyModal
                        open={isCopyOpen}
                        onOpenChange={setIsCopyOpen}
                        itemId={activeItem?.id}
                        itemName={activeItem?.filename}
                        itemType="file"
                        items={bulkActionItems.length > 0 ? bulkActionItems : undefined}
                        onItemCopied={onItemCopied}
                    />

                    <RenameModal
                        open={isRenameOpen}
                        onOpenChange={setIsRenameOpen}
                        itemName={activeItem?.filename}
                        initialName={activeItem?.filename}
                        itemType="file"
                        onRename={async (data) => {
                            if (!activeItem) return;
                            try {
                                // Type assertion to bypass TS check for now as we know the structure from modal
                                const renameData = data as any;
                                const response = await apiClient.updateFile(activeItem.id, renameData);

                                if (response.success) {
                                    toast.success("Renamed successfully");
                                    onItemRenamed({ requestedName: renameData.requestedName });
                                } else {
                                    toast.error(response.error || "Failed to rename");
                                }
                            } catch {
                                toast.error("Failed to rename");
                            }
                        }}
                    />

                    <ShareModal
                        open={isShareOpen}
                        onOpenChange={setIsShareOpen}
                        itemId={activeItem?.id}
                        itemName={activeItem?.filename}
                        itemType="file"
                    />

                    <SpacePickerModal
                        open={isAddToSpaceOpen}
                        onOpenChange={setIsAddToSpaceOpen}
                        fileIds={activeItem ? [activeItem.id] : []}
                        onAdded={() => {
                            // Refresh handled by toast
                        }}
                    />
                </div>
            </main>
        </div>
    )
}

export default function PhotosPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-svh" />}>
            <PhotosPageContent />
        </Suspense>
    )
}
