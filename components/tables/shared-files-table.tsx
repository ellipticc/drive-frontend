"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import {
    IconDots,
    IconDownload,
    IconCopy,
    IconInfoCircle,
    IconTrash,
    IconFile,
    IconFolder,
    IconCheck,
    IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useFormatter } from "@/hooks/use-formatter"
import { formatFileSize } from "@/lib/utils";
import type { SortDescriptor } from "react-aria-components";

import { apiClient, SharedItem } from "@/lib/api"
import { decryptUserPrivateKeys } from "@/lib/crypto"
import { decryptShareInWorker } from '@/lib/decrypt-share-pool'
import { setCekForShare, getCekForShare } from '@/lib/share-cache'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import dynamic from 'next/dynamic'
import { useGlobalUpload } from "@/components/global-upload-context"
import { Table, TableCard } from "@/components/application/table/table"
import { Checkbox } from "@/components/base/checkbox/checkbox"
import { TableSkeleton } from "@/components/tables/table-skeleton"
import { useLanguage } from "@/lib/i18n/language-context"
import { TruncatedNameTooltip } from "@/components/tables/truncated-name-tooltip"
import { FileThumbnail } from "@/components/files/file-thumbnail"
import { useIsMobile } from "@/hooks/use-mobile"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { downloadFolderAsZip } from "@/lib/download"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconGrid3x3, IconListDetails, IconDownload as IconDownload2, IconCopy as IconCopy2, IconInfoSquare } from "@tabler/icons-react"

const DetailsModal = dynamic(() => import("@/components/modals/details-modal").then(mod => mod.DetailsModal));
const CopyModal = dynamic(() => import("@/components/modals/copy-modal").then(mod => mod.CopyModal));
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SharedFilesTableProps {
    status?: string // Optional filter
}

export function SharedFilesTable({ status }: SharedFilesTableProps) {
    const { t } = useLanguage()
    const [items, setItems] = useState<SharedItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState<string | null>(null)
    const { formatDate } = useFormatter()
    const isMobile = useIsMobile()

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

    // Alert Dialog State
    const [alertOpen, setAlertOpen] = useState(false)
    const [alertConfig, setAlertConfig] = useState<{
        title: string;
        description: string;
        actionLabel: string;
        actionVariant?: "default" | "destructive";
        onConfirm: () => Promise<void>;
    } | null>(null)

    // Decrypted names cache
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({})

    // Details & Copy modal state
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: 'file' | 'folder' | 'paper'; shareId?: string } | null>(null)

    const [copyModalOpen, setCopyModalOpen] = useState(false)
    const [selectedItemForCopy, setSelectedItemForCopy] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null)

    // View mode for toggle (table vs grid)
    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        try {
            return (localStorage.getItem('sharedWithMeViewMode') as 'table' | 'grid') || 'table'
        } catch (e) {
            return 'table'
        }
    })

    const handleViewModeChange = (newMode: 'table' | 'grid') => {
        setViewMode(newMode)
        try { localStorage.setItem('sharedWithMeViewMode', newMode) } catch (e) { }
    }

    const { startFileDownload, startFolderDownload, startFileDownloadWithCEK, startBulkDownload } = useGlobalUpload()

    const fetchItems = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await apiClient.getSharedWithMe(status)
            if (response.success && response.data) {
                setItems(response.data)

                // Fetch user data to get private keys
                const userRes = await apiClient.getMe();
                let kyberPrivateKey: Uint8Array | undefined;

                if (userRes.success && userRes.data) {
                    try {
                        const userData = (userRes.data as any).user || userRes.data;
                        const keys = await decryptUserPrivateKeys(userData);
                        kyberPrivateKey = keys.kyberPrivateKey;
                    } catch (e) {
                        // Fallback or ignore if keys unavailable (e.g. not fully setup)
                    }
                }

                let newDecrypted: Record<string, string> = {};
                if (kyberPrivateKey) {
                    // Offload KEM decapsulation + filename decryption to worker pool for responsiveness
                    await Promise.all(response.data.map(async (item) => {
                        if (!item.kyberCiphertext || !item.encryptedCek || !item.encryptedCekNonce) {
                            return;
                        }

                        try {
                            // Use worker pool to derive CEK and decrypt filename if available
                            const res = await decryptShareInWorker({ id: item.id, kyberPrivateKey: kyberPrivateKey.buffer as ArrayBuffer, share: item });
                            if (res && res.cek) {
                                const cek = new Uint8Array(res.cek);
                                setCekForShare(item.id, cek);
                            }
                            if (res && res.name) {
                                // Allow valid names (removed strict ASCII check)
                                newDecrypted[item.id] = res.name;
                            }
                        } catch (e) {
                            console.error("Worker decryption failed for item " + item.id, e);
                            newDecrypted[item.id] = "Decryption Failed";
                        }
                    }));
                }
                setDecryptedNames(prev => ({ ...prev, ...newDecrypted }));
            }
        } catch (err) {
            console.error("Failed to fetch shared items", err)
            toast.error("Failed to load shared items")
        } finally {
            setIsLoading(false)
        }
    }, [status])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    // Bulk actions
    const handleAcceptBulk = async () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        setIsProcessing('bulk-accept');
        try {
            await Promise.all(ids.map(id => apiClient.acceptSharedItem(id)));
            toast.success('Accepted selected shares');
            // update local state
            setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, status: 'accepted' } : item));
            setSelectedItems(new Set());
        } catch (err) {
            toast.error('Failed to accept selected shares');
        } finally {
            setIsProcessing(null);
        }
    }

    const handleDeclineBulk = async () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        setIsProcessing('bulk-decline');
        try {
            await Promise.all(ids.map(id => apiClient.declineSharedItem(id)));
            toast.success('Declined selected shares');
            setItems(prev => prev.filter(i => !ids.includes(i.id)));
            setSelectedItems(new Set());
        } catch (err) {
            toast.error('Failed to decline selected shares');
        } finally {
            setIsProcessing(null);
        }
    }

    const handleHeaderDownloadBulk = async () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        // Build items compatible with startBulkDownload
        const itemsForDownload = items.filter(i => ids.includes(i.id)).map(i => ({ id: i.item.id, name: decryptedNames[i.id] || i.item.name || '', type: i.item.type === 'folder' ? 'folder' as const : i.item.type === 'paper' ? 'paper' as const : 'file' as const }));
        try {
            await startBulkDownload(itemsForDownload);
        } catch (err) {
            console.error('Bulk download failed', err);
            toast.error('Bulk download failed');
        }
    }

    const handleHeaderCopy = () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        const firstId = ids[0];
        const item = items.find(i => i.id === firstId);
        if (!item) return;
        setSelectedItemForCopy({ id: item.item.id, name: decryptedNames[item.id] || item.item.name || 'item', type: item.item.type === 'folder' ? 'folder' : 'file' });
        setCopyModalOpen(true);
    }

    const handleHeaderDetails = () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        const firstId = ids[0];
        const item = items.find(i => i.id === firstId);
        if (!item) return;
        setSelectedItemForDetails({ id: item.item.id, name: decryptedNames[item.id] || item.item.name || 'item', type: item.item.type === 'folder' ? 'folder' : item.item.type === 'paper' ? 'paper' : 'file', shareId: item.id });
        setDetailsModalOpen(true);
    }

    const handleRemoveBulk = async () => {
        const ids = Array.from(selectedItems);
        if (ids.length === 0) return;
        setIsProcessing('bulk-remove');
        try {
            await Promise.all(ids.map(id => apiClient.removeSharedItem(id)));
            toast.success('Removed selected shares');
            setItems(prev => prev.filter(i => !ids.includes(i.id)));
            setSelectedItems(new Set());
        } catch (err) {
            toast.error('Failed to remove selected shares');
        } finally {
            setIsProcessing(null);
        }
    }

    const handleAccept = async (id: string) => {
        setIsProcessing(id)
        try {
            const res = await apiClient.acceptSharedItem(id)
            if (res.success) {
                toast.success("Share accepted")
                // Update local state
                setItems(prev => prev.map(item =>
                    item.id === id ? { ...item, status: 'accepted' } : item
                ))
            } else {
                toast.error(res.error || "Failed to accept share")
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setIsProcessing(null)
        }
    }

    const confirmDecline = (id: string) => {
        setAlertConfig({
            title: "Decline Share",
            description: "Are you sure you want to decline this share? It will be removed from your list.",
            actionLabel: "Decline",
            actionVariant: "destructive",
            onConfirm: async () => {
                try {
                    const res = await apiClient.declineSharedItem(id)
                    if (res.success) {
                        toast.success("Share declined")
                        setItems(prev => prev.filter(item => item.id !== id))
                    } else {
                        toast.error(res.error || "Failed to decline")
                    }
                } catch (err) {
                    toast.error("An error occurred")
                }
            }
        })
        setAlertOpen(true)
    }

    const confirmRemove = (id: string) => {
        setAlertConfig({
            title: "Remove Shared Item",
            description: "Are you sure you want to remove this item? You will lose access to it.",
            actionLabel: "Remove",
            actionVariant: "destructive",
            onConfirm: async () => {
                try {
                    const res = await apiClient.removeSharedItem(id)
                    if (res.success) {
                        toast.success("Item removed")
                        setItems(prev => prev.filter(item => item.id !== id))
                    } else {
                        toast.error(res.error || "Failed to remove")
                    }
                } catch (err) {
                    toast.error("An error occurred")
                }
            }
        })
        setAlertOpen(true)
    }

    const handleDownload = async (item: SharedItem) => {
        setIsProcessing(item.id)
        try {
            // If file: decapsulate shared secret and hand to global download manager which shows unified progress
            if (item.item.type === 'file') {
                // Check if CEK is cached for this share
                const cachedCek = getCekForShare(item.id);
                if (cachedCek) {
                    if (!startFileDownloadWithCEK) throw new Error('Global download manager not available for CEK-based downloads');
                    await startFileDownloadWithCEK(item.item.id, decryptedNames[item.id] || item.item.name || 'file', cachedCek);
                    toast.success('Download completed');
                    return;
                }

                // If not cached, perform worker-based derivation and cache it
                if (!item.kyberCiphertext || !item.encryptedCek || !item.encryptedCekNonce) {
                    throw new Error('Missing encryption material for this shared file');
                }

                const userRes = await apiClient.getMe();
                if (!userRes.success || !userRes.data) {
                    throw new Error('Unable to retrieve user keys to decrypt this share');
                }

                let keys: any;
                try {
                    keys = await decryptUserPrivateKeys(userRes.data as any);
                } catch (e) {
                    throw new Error('Failed to decrypt user private keys');
                }

                if (!keys || !keys.kyberPrivateKey) {
                    throw new Error('Missing Kyber private key; cannot decrypt this shared file');
                }

                try {
                    const res = await decryptShareInWorker({ id: item.id, kyberPrivateKey: keys.kyberPrivateKey.buffer as ArrayBuffer, share: item });
                    if (!res || !res.cek) throw new Error('Failed to derive CEK from share');
                    const cek = new Uint8Array(res.cek);
                    setCekForShare(item.id, cek);

                    if (!startFileDownloadWithCEK) throw new Error('Global download manager not available for CEK-based downloads');
                    await startFileDownloadWithCEK(item.item.id, decryptedNames[item.id] || item.item.name || 'file', cek);
                    toast.success('Download completed');
                } catch (e) {
                    console.error('Download failed (derivation)', e);
                    throw e;
                }

                return;
            } else if (item.item.type === 'folder') {
                // Use global folder download which shows unified progress
                if (startFolderDownload) {
                    await startFolderDownload(item.item.id, decryptedNames[item.id] || item.item.name || 'folder')
                    toast.success('Folder download completed')
                } else {
                    // Fallback
                    const userRes = await apiClient.getMe();
                    let userKeys: any | undefined;
                    if (userRes.success && userRes.data) {
                        try {
                            userKeys = await decryptUserPrivateKeys(userRes.data as any);
                        } catch (e) {
                            // ignore
                        }
                    }
                    await downloadFolderAsZip(item.item.id, decryptedNames[item.id] || item.item.name || 'folder', userKeys, () => { })
                    toast.success('Folder download completed')
                }
            } else {
                toast.error('Downloading this type is not implemented yet')
            }
        } catch (err: any) {
            console.error('Download failed', err)
            toast.error(err?.message || 'Download failed')
        } finally {
            setIsProcessing(null)
        }
    }

    const handleCopyLink = async (share: SharedItem) => {
        try {
            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/s?shareId=${share.id}`
            await navigator.clipboard.writeText(url)
            toast.success('Share link copied to clipboard')
        } catch (err) {
            toast.error('Failed to copy link')
        }
    }

    const openDetails = (share: SharedItem) => {
        setSelectedItemForDetails({ id: share.item.id, name: decryptedNames[share.id] || share.item.name || 'item', type: share.item.type === 'folder' ? 'folder' : share.item.type === 'paper' ? 'paper' : 'file', shareId: share.id })
        setDetailsModalOpen(true)
    }

    // Filter items based on status
    const filteredItems = useMemo(() => {
        if (!status) return items;
        return items.filter(item => item.status === status);
    }, [items, status]);

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "date",
        direction: "descending",
    });

    // Sort items
    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            if (sortDescriptor.column === 'date') {
                const firstDate = new Date(a.createdAt).getTime();
                const secondDate = new Date(b.createdAt).getTime();
                return sortDescriptor.direction === "descending" ? secondDate - firstDate : firstDate - secondDate;
            }
            if (sortDescriptor.column === 'name') {
                const nameA = decryptedNames[a.id] || a.item.name || '';
                const nameB = decryptedNames[b.id] || b.item.name || '';
                let cmp = nameA.localeCompare(nameB);
                if (sortDescriptor.direction === "descending") cmp *= -1;
                return cmp;
            }
            if (sortDescriptor.column === 'sharedBy') {
                const nameA = a.owner.name || '';
                const nameB = b.owner.name || '';
                let cmp = nameA.localeCompare(nameB);
                if (sortDescriptor.direction === "descending") cmp *= -1;
                return cmp;
            }
            if (sortDescriptor.column === 'size') {
                // If it's a folder/paper, we might treat size as 0 or ignore
                const sizeA = a.item.type === 'file' ? (a.item.size || 0) : 0;
                const sizeB = b.item.type === 'file' ? (b.item.size || 0) : 0;
                return sortDescriptor.direction === "descending" ? sizeB - sizeA : sizeA - sizeB;
            }
            return 0;
        });
    }, [filteredItems, sortDescriptor, decryptedNames]);

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useWindowVirtualizer({
        count: sortedItems.length,
        estimateSize: () => 50,
        overscan: 5,
        scrollMargin: parentRef.current?.offsetTop ?? 0,
    });

    const renderHeaderIcons = () => {
        const selCount = selectedItems.size
        const ids = Array.from(selectedItems)
        const selected = items.filter(i => ids.includes(i.id))
        const hasPending = selected.some(i => i.status === 'pending')
        const hasAccepted = selected.some(i => i.status === 'accepted')

        // No selection: only grid toggle
        if (selCount === 0) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')} aria-label={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}>
                            {viewMode === 'table' ? <IconGrid3x3 className="h-3.5 w-3.5" /> : <IconListDetails className="h-3.5 w-3.5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}</TooltipContent>
                </Tooltip>
            )
        }

        // Selection present: conditionally show accept/decline and accepted-actions
        return (
            <div className="flex items-center gap-1.5 md:gap-2">
                {hasPending && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleAcceptBulk} aria-label={`Accept ${selCount} selected`}>
                                    <IconCheck className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Accept</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleDeclineBulk} aria-label={`Decline ${selCount} selected`}>
                                    <IconX className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Decline</TooltipContent>
                        </Tooltip>
                        <div className="h-5 w-px bg-border mx-1" />
                    </>
                )}

                {hasAccepted && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleHeaderDownloadBulk} aria-label={`Download ${selCount} selected`}>
                                    <IconDownload className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleHeaderCopy} aria-label="Copy">
                                    <IconCopy className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleHeaderDetails} aria-label="Details">
                                    <IconInfoSquare className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Details</TooltipContent>
                        </Tooltip>
                        <div className="h-5 w-px bg-border mx-1" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleRemoveBulk} aria-label={`Remove ${selCount} selected`}>
                                    <IconTrash className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                        <div className="h-5 w-px bg-border mx-1" />
                    </>
                )}

                {/* Always show view toggle */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')} aria-label={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}>
                            {viewMode === 'table' ? <IconGrid3x3 className="h-3.5 w-3.5" /> : <IconListDetails className="h-3.5 w-3.5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}</TooltipContent>
                </Tooltip>
            </div>
        )
    }

    if (isLoading) {
        // Show a single TableSkeleton to prevent duplicate headers / flicker
        return (
            <TableSkeleton title={t('sidebar.sharedWithMe')} headerIcons={null} />
        )
    }

    if (items.length === 0) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header title={t('sidebar.sharedWithMe')} className="h-10 border-0" />
                <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <IconFolder className="size-10 mb-4 opacity-20 mx-auto" />
                        <p className="text-sm text-muted-foreground">No items shared with you yet.</p>
                    </div>
                </div>
            </TableCard.Root>
        )
    }

    // Grid View
    if (viewMode === 'grid') {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title={t('sidebar.sharedWithMe')}
                    contentTrailing={renderHeaderIcons()}
                    className="h-10 border-0"
                />
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {/* Simplified Grid View - Improvements can be made here later if needed */}
                    {sortedItems.map((item) => (
                        <div key={item.id} className="border rounded-md p-4 hover:bg-muted/50 cursor-pointer flex flex-col gap-2 relative group" onDoubleClick={() => openDetails(item)}>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Checkbox
                                    isSelected={selectedItems.has(item.id)}
                                    className="data-[state=checked]:opacity-100"
                                    onChange={(checked: boolean) => {
                                        const newSet = new Set(selectedItems);
                                        if (checked) newSet.add(item.id);
                                        else newSet.delete(item.id);
                                        setSelectedItems(newSet);
                                    }}
                                />
                            </div>
                            <div className="flex justify-center py-4">
                                {item.item.type === 'folder' ? (
                                    <IconFolder className="size-12 text-blue-500" />
                                ) : (
                                    <FileThumbnail
                                        fileId={item.item.id}
                                        mimeType={item.item.type === 'paper' ? 'application/x-paper' : item.item.mimeType}
                                        name={decryptedNames[item.id] || item.item.name || ''}
                                        className="size-12"
                                        iconClassName="size-12"
                                    />
                                )}
                            </div>
                            <div className="text-sm font-medium truncate text-center">
                                {decryptedNames[item.id] || item.item.name || 'Shared Item'}
                            </div>
                            <div className="text-xs text-muted-foreground text-center">
                                {item.owner.name}
                            </div>
                        </div>
                    ))}
                </div>
            </TableCard.Root>
        );
    }

    // Table View
    return (
        <>
            <TableCard.Root size="sm">
                <TableCard.Header
                    title={t('sidebar.sharedWithMe')}
                    contentTrailing={renderHeaderIcons()}
                    className="h-10 border-0"
                />

                <div ref={parentRef} className="w-full relative">
                    <Table
                        aria-label="Shared With Me"
                        selectionMode="multiple"
                        selectionBehavior="toggle"
                        sortDescriptor={sortDescriptor}
                        onSortChange={setSortDescriptor}
                        selectedKeys={selectedItems}
                        onSelectionChange={(keys) => {
                            if (keys === 'all') {
                                if (selectedItems.size > 0 && selectedItems.size < items.length) {
                                    setSelectedItems(new Set());
                                } else {
                                    setSelectedItems(new Set(items.map(item => item.id)));
                                }
                            } else {
                                setSelectedItems(new Set(Array.from(keys as Set<string>)));
                            }
                        }}
                    >
                        <Table.Header className="group sticky top-0 z-40 bg-background border-b">
                            <Table.Head className="w-10 text-center pl-4 pr-0">
                                <Checkbox
                                    slot="selection"
                                    aria-label={selectedItems.size > 0 && selectedItems.size === items.length ? `Deselect all ${selectedItems.size} selected` : `Select all`}
                                    className={`transition-opacity duration-200 ${selectedItems.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                />
                            </Table.Head>
                            <Table.Head id="name" isRowHeader allowsSorting={selectedItems.size === 0} className="w-full max-w-0 pointer-events-none cursor-default" align="left">
                                {selectedItems.size > 0 ? (
                                    <span className="text-xs font-semibold whitespace-nowrap text-foreground px-1.5 py-1">{selectedItems.size} selected</span>
                                ) : (
                                    <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Name</span>
                                )}
                            </Table.Head>
                            {!isMobile && (
                                <Table.Head id="sharedBy" allowsSorting className={`pointer-events-none cursor-default w-[200px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`}>
                                    <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Shared By</span>
                                </Table.Head>
                            )}
                            {!isMobile && (
                                <Table.Head id="date" allowsSorting align="right" className={`pointer-events-none cursor-default min-w-[120px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`}>
                                    <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Shared at</span>
                                </Table.Head>
                            )}
                            {!isMobile && (
                                <Table.Head id="size" allowsSorting align="right" className={`pointer-events-none cursor-default min-w-[100px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`}>
                                    <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Size</span>
                                </Table.Head>
                            )}
                            <Table.Head id="actions" align="center" />
                        </Table.Header>

                        <Table.Body dependencies={[sortedItems, selectedItems.size, rowVirtualizer.getVirtualItems()]}>
                            {/* Top Spacer */}
                            {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start - rowVirtualizer.options.scrollMargin > 0 && (
                                <Table.Row id="spacer-top" className="hover:bg-transparent border-0 focus-visible:outline-none">
                                    <Table.Cell colSpan={isMobile ? 3 : 6} style={{ height: rowVirtualizer.getVirtualItems()[0].start - rowVirtualizer.options.scrollMargin, padding: 0 }} />
                                </Table.Row>
                            )}

                            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                const item = sortedItems[virtualItem.index];
                                const isPending = item.status === 'pending';

                                return (
                                    <Table.Row
                                        key={item.id}
                                        id={item.id}
                                        data-index={virtualItem.index}
                                        ref={rowVirtualizer.measureElement}
                                        onDoubleClick={() => openDetails(item)}
                                        className={`group transition-colors duration-150 ${selectedItems.has(item.id) ? "bg-muted/50" : "hover:bg-muted/50"}`}
                                    >
                                        <Table.Cell className="w-10 text-center pl-4 pr-0">
                                            <Checkbox
                                                slot="selection"
                                                aria-label={`Select ${decryptedNames[item.id] || item.item.name || 'shared item'}`}
                                                className={`transition-opacity duration-200 ${selectedItems.size > 0 || selectedItems.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                            />
                                        </Table.Cell>

                                        <Table.Cell className="w-full max-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="text-base">
                                                    {item.item.type === 'folder' ? (
                                                        <IconFolder className="h-4 w-4 text-blue-500 inline-block align-middle" />
                                                    ) : (
                                                        <FileThumbnail
                                                            fileId={item.item.id}
                                                            mimeType={item.item.type === 'paper' ? 'application/x-paper' : item.item.mimeType}
                                                            name={decryptedNames[item.id] || item.item.name || ''}
                                                            className={`h-4 w-4 inline-block align-middle ${isPending ? 'opacity-70' : ''}`}
                                                            iconClassName="h-4 w-4"
                                                        />
                                                    )}
                                                </div>
                                                <TruncatedNameTooltip
                                                    name={decryptedNames[item.id] || item.item.name || 'Shared Item'}
                                                    className={`text-sm font-medium whitespace-nowrap cursor-default flex-1 min-w-0 ${isPending ? 'text-muted-foreground italic' : 'text-foreground'}`}
                                                />
                                                {isPending && <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 ml-1.5 mt-0.5">Pending</span>}
                                            </div>
                                        </Table.Cell>

                                        {!isMobile && (
                                            <Table.Cell className="w-[200px]">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="size-6">
                                                        <AvatarImage src={item.owner.avatar} />
                                                        <AvatarFallback>{item.owner.name.substring(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col text-xs truncate">
                                                        <span className="font-medium truncate">{item.owner.name}</span>
                                                        <span className="text-muted-foreground text-[10px] truncate">{item.owner.email}</span>
                                                    </div>
                                                </div>
                                            </Table.Cell>
                                        )}

                                        {!isMobile && (
                                            <Table.Cell className="text-right h-12 w-[120px]">
                                                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDate(new Date(item.createdAt))}</span>
                                            </Table.Cell>
                                        )}

                                        {!isMobile && (
                                            <Table.Cell className="text-right h-12 w-[100px]">
                                                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                    {item.item.type === 'folder' || item.item.type === 'paper' ? '--' : (item.item.size ? formatFileSize(item.item.size) : '--')}
                                                </span>
                                            </Table.Cell>
                                        )}

                                        <Table.Cell className="px-3 h-12">
                                            <div className="flex justify-end gap-1 h-full items-center">
                                                {isPending ? (
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleAccept(item.id)}>
                                                            <IconCheck className="h-3 w-3 mr-1" /> Accept
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => confirmDecline(item.id)}>
                                                            <IconX className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                aria-label="Open actions"
                                                                onClick={(e) => e.stopPropagation()}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                            >
                                                                <IconDots className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDownload(item)}>
                                                                <IconDownload className="h-4 w-4 mr-2" /> Download
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => { setSelectedItemForCopy({ id: item.item.id, name: decryptedNames[item.id] || item.item.name || 'item', type: item.item.type === 'folder' ? 'folder' : 'file' }); setCopyModalOpen(true); }}>
                                                                <IconCopy className="h-4 w-4 mr-2" /> Copy
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => { setSelectedItemForDetails({ id: item.item.id, name: decryptedNames[item.id] || item.item.name || 'item', type: item.item.type === 'folder' ? 'folder' : item.item.type === 'paper' ? 'paper' : 'file', shareId: item.id }); setDetailsModalOpen(true); }}>
                                                                <IconInfoCircle className="h-4 w-4 mr-2" /> Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmRemove(item.id)}>
                                                                <IconTrash className="h-4 w-4 mr-2" /> Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}

                            {/* Bottom Spacer */}
                            {rowVirtualizer.getVirtualItems().length > 0 && (
                                (() => {
                                    const lastItem = rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1];
                                    const bottomSpace = rowVirtualizer.getTotalSize() - lastItem.end;
                                    if (bottomSpace > 0) {
                                        return (
                                            <Table.Row id="spacer-bottom" className="hover:bg-transparent border-0 focus-visible:outline-none">
                                                <Table.Cell colSpan={isMobile ? 3 : 5} style={{ height: bottomSpace, padding: 0 }} />
                                            </Table.Row>
                                        );
                                    }
                                    return null;
                                })()
                            )}
                        </Table.Body>
                    </Table>
                </div>
            </TableCard.Root>

            <DetailsModal
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
                itemId={selectedItemForDetails?.id}
                itemName={selectedItemForDetails?.name}
                itemType={selectedItemForDetails?.type}
                shareId={selectedItemForDetails?.shareId}
            />

            <CopyModal
                open={copyModalOpen}
                onOpenChange={setCopyModalOpen}
                itemId={selectedItemForCopy?.id}
                itemName={selectedItemForCopy?.name}
                itemType={selectedItemForCopy?.type}
            />

            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertConfig?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertConfig?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault();
                                if (alertConfig?.onConfirm) {
                                    await alertConfig.onConfirm();
                                }
                                setAlertOpen(false);
                            }}
                            className={alertConfig?.actionVariant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                        >
                            {alertConfig?.actionLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
