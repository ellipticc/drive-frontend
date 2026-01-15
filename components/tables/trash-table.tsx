"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useFormatter } from "@/hooks/use-formatter";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconRestore, IconTrash } from "@tabler/icons-react";
const DeletePermanentlyModal = dynamic(() => import("@/components/modals/delete-permanently-modal").then(mod => mod.DeletePermanentlyModal));
const DetailsModal = dynamic(() => import("@/components/modals/details-modal").then(mod => mod.DetailsModal));
const FullPagePreviewModal = dynamic(() => import('@/components/previews/full-page-preview-modal').then(m => m.FullPagePreviewModal));
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { IconFolder, IconInfoCircle, IconTrash as IconTrashAlt, IconX, IconEye } from "@tabler/icons-react";
import { apiClient, FileContentItem, FolderContentItem } from "@/lib/api";
import { formatFileSize } from "@/lib/utils";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { TruncatedNameTooltip } from "./truncated-name-tooltip";
import { masterKeyManager } from "@/lib/master-key";
import { decryptFilenameInWorker } from "@/lib/filename-decryption-pool";
import { useUser } from "@/components/user-context";
import { FileThumbnail } from "../files/file-thumbnail";
import {
    ActionBar,
    ActionBarSelection,
    ActionBarGroup,
    ActionBarItem,
    ActionBarClose,
    ActionBarSeparator,
} from "@/components/ui/action-bar";

interface TrashItem {
    id: string;
    name: string;
    filename?: string;
    size?: number;
    mimeType?: string;
    type: 'file' | 'folder' | 'paper';
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
    shaHash?: string | null;
    encryptedFilename?: string;
    filenameSalt?: string;
    encryptedName?: string;
    nameSalt?: string;
    encryptedTitle?: string;
    titleSalt?: string;
}

export const TrashTable = ({ searchQuery }: { searchQuery?: string }) => {
    const { user, updateStorage } = useUser();
    const { formatDate } = useFormatter();
    const isMobile = useIsMobile();

    // Calculate retention period text based on user plan
    const retentionText = useMemo(() => {
        const plan = user?.plan || 'Free';
        if (plan.includes('Unlimited')) return "Items in trash are never automatically deleted.";

        // Handle "Ellipticc Plus" or "Plus"
        let days = 30; // Default Free
        if (plan.includes('Plus')) days = 60;
        if (plan.includes('Pro')) days = 90;

        return `Items in trash are permanently deleted after ${days} days.`;
    }, [user?.plan]);

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "deletedAt",
        direction: "descending",
    });

    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Dropdown open row persistence
    const [menuOpenRow, setMenuOpenRow] = useState<string | null>(null);

    // Preview state (for previewing files from trash)
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [previewIndex, setPreviewIndex] = useState(-1);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const setTrashPreviewParam = (id?: string) => {
        try {
            const params = new URLSearchParams(searchParams.toString());
            if (id) params.set('preview', id);
            else params.delete('preview');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        } catch (err) {
            // ignore
        }
    }

    const openPreviewForTrash = (itemId: string) => {
        const index = trashItems.findIndex(i => i.id === itemId);
        const item = trashItems[index];
        if (!item) return;
        if (item.type === 'paper') {
            // Papers open in view-mode only
            window.open('/paper/' + item.id + '?viewMode=view', '_blank');
            return;
        }
        // Files: open preview modal
        if (item.filename || item.mimeType) {
            setPreviewFile({ id: item.id, name: item.filename || item.name || '', type: 'file', mimeType: item.mimeType, size: item.size });
            setPreviewIndex(index);
            setTrashPreviewParam(item.id);
        }
    };
    const closePreviewTrash = () => {
        setPreviewFile(null);
        setTrashPreviewParam(undefined);
    };
    const navigatePreviewTrash = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev' ? previewIndex - 1 : previewIndex + 1;
        if (newIndex >= 0 && newIndex < trashItems.length) {
            const newItem = trashItems[newIndex];
            openPreviewForTrash(newItem.id);
        }
    };

    // Read preview param on mount and open if valid
    useEffect(() => {
        const previewId = searchParams?.get('preview');
        if (!previewId) return;
        const idx = trashItems.findIndex(i => i.id === previewId);
        if (idx >= 0) {
            openPreviewForTrash(previewId);
        } else {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('preview');
            try {
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            } catch (err) {
                // ignore
            }
        }
    }, [searchParams, trashItems, pathname, router]);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedItemForDelete, setSelectedItemForDelete] = useState<{ id: string; name: string; type: "file" | "folder" | "paper" } | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: "file" | "folder" | "paper" } | null>(null);
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const limit = 50;

    // Load trash items on component mount or page change
    useEffect(() => {
        refreshTrash();
    }, [page]);

    // Refresh trash items
    const refreshTrash = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch trash files and folders (papers are now included in files)
            const [filesResponse, foldersResponse] = await Promise.all([
                apiClient.getTrashFiles({ page, limit }),
                apiClient.getTrashFolders({ page, limit })
            ]);

            if (filesResponse?.success && foldersResponse?.success) {
                // Update pagination info
                let filePages = 1;
                let folderPages = 1;
                let fileTotal = 0;
                let folderTotal = 0;

                if (filesResponse.data && 'pagination' in filesResponse.data) {
                    filePages = filesResponse.data.pagination.totalPages;
                    fileTotal = filesResponse.data.pagination.total;
                }

                if (foldersResponse.data && 'pagination' in (foldersResponse.data as Record<string, unknown>)) {
                    folderPages = ((foldersResponse.data as Record<string, unknown>).pagination as Record<string, unknown>).totalPages as number;
                    folderTotal = ((foldersResponse.data as Record<string, unknown>).pagination as Record<string, unknown>).total as number;
                }

                setTotalPages(Math.max(filePages, folderPages));
                setTotalItems(fileTotal + folderTotal);

                // Get master key for filename decryption - we ALWAYS have access to it
                let masterKey: Uint8Array | null = null;
                try {
                    masterKey = masterKeyManager.getMasterKey();
                    if (!masterKey) {
                        throw new Error('Master key not available');
                    }
                } catch (err) {
                    console.error('Failed to get master key:', err);
                    setError('Unable to decrypt files - master key not available');
                    setIsLoading(false);
                    return;
                }

                // Decrypt folders synchronously since we have master key
                const foldersData = (foldersResponse.data && 'data' in (foldersResponse.data as Record<string, unknown>)) ? (foldersResponse.data as Record<string, unknown>).data : (foldersResponse.data || []);
                const decryptedFolders = await Promise.all(
                    ((foldersData || []) as FolderContentItem[]).map(async (folder: FolderContentItem) => {
                        let decryptedName = '(Unnamed folder)';
                        if (folder.encryptedName && folder.nameSalt) {
                            try {
                                decryptedName = await decryptFilenameInWorker(folder.encryptedName, folder.nameSalt, masterKey!);
                            } catch (err) {
                                decryptedName = '(Unnamed folder)';
                            }
                        }
                        return {
                            id: folder.id,
                            name: decryptedName || '(Unnamed folder)',
                            type: 'folder' as const,
                            createdAt: folder.createdAt,
                            updatedAt: folder.updatedAt,
                            deletedAt: folder.deletedAt || '',
                        };
                    })
                );

                // Decrypt files synchronously since we have master key
                const filesData = (filesResponse.data && 'files' in filesResponse.data) ? filesResponse.data.files : [];
                const decryptedFiles = await Promise.all(
                    ((filesData || []) as unknown as FileContentItem[]).map(async (file: FileContentItem) => {
                        let decryptedName = '(Unnamed file)';
                        if (file.encryptedFilename && file.filenameSalt) {
                            try {
                                decryptedName = await decryptFilenameInWorker(file.encryptedFilename, file.filenameSalt, masterKey!);
                            } catch (err) {
                                decryptedName = '(Unnamed file)';
                            }
                        }

                        // Check if it's a paper based on mimetype
                        const isPaper = file.mimetype === 'application/x-paper' || file.mimeType === 'application/x-paper';

                        return {
                            id: file.id,
                            name: decryptedName || '(Unnamed file)',
                            filename: file.filename,
                            size: file.size,
                            mimeType: file.mimetype,
                            type: isPaper ? 'paper' as const : 'file' as const,
                            createdAt: file.created_at || file.createdAt,
                            updatedAt: file.updated_at || file.updatedAt,
                            deletedAt: file.deleted_at || file.deletedAt || '',
                            shaHash: file.sha_hash || file.shaHash,
                            folderId: file.folder_id || file.folderId,
                        };
                    })
                );

                // Combine all items
                const allItems = [...decryptedFolders, ...decryptedFiles];
                setTrashItems(allItems);
            } else {
                setError('Failed to load trash items');
            }
        } catch (err) {
            console.error('Error refreshing trash:', err);
            setError('Failed to load trash items');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreClick = async (itemId: string, itemName: string, itemType: "file" | "folder" | "paper") => {
        try {
            let response;
            if (itemType === 'file' || itemType === 'paper') {
                // Use generic file restore for papers as well (unification)
                response = await apiClient.restoreFileFromTrash(itemId);
            } else {
                response = await apiClient.restoreFolderFromTrash(itemId);
            }

            if (response.success) {
                // Remove the item from trash view immediately
                setTrashItems(prevItems => prevItems.filter(item => item.id !== itemId));

                // Show toast with undo option
                toast(`${itemType === 'paper' ? 'Paper' : itemType} restored successfully`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            try {
                                let moveBackResponse;
                                if (itemType === 'file' || itemType === 'paper') {
                                    moveBackResponse = await apiClient.moveFileToTrash(itemId);
                                } else {
                                    moveBackResponse = await apiClient.moveFolderToTrash(itemId);
                                }

                                if (moveBackResponse.success) {
                                    toast.success(`${itemType === 'paper' ? 'Paper' : itemType} moved back to trash`);
                                    refreshTrash();
                                } else {
                                    toast.error(`Failed to move ${itemType === 'paper' ? 'Paper' : itemType} back to trash`);
                                    refreshTrash();
                                }
                            } catch (error) {
                                console.error('Move back to trash error:', error);
                                toast.error(`Failed to move ${itemType === 'paper' ? 'Paper' : itemType} back to trash`);
                                refreshTrash();
                            }
                        },
                    },
                });
            } else {
                toast.error(response.error || `Failed to restore ${itemType}`);
            }
        } catch (error) {
            console.error('Restore error:', error);
            toast.error(`Failed to restore ${itemType}`);
        }
    };

    const handleDeleteClick = (itemId: string, itemName: string, itemType: "file" | "folder" | "paper") => {
        setSelectedItemForDelete({ id: itemId, name: itemName, type: itemType });
        setDeleteModalOpen(true);
    };

    const handleDetailsClick = async (itemId: string, itemName: string, itemType: "file" | "folder" | "paper") => {
        setSelectedItemForDetails({ id: itemId, name: itemName, type: itemType });
        setDetailsModalOpen(true);
    };

    const handleRestoreBulk = async () => {
        const hasSelection = selectedItems.size > 0;
        if (!hasSelection && trashItems.length === 0) return;

        try {
            // Determine which items to restore
            const itemsToRestore = hasSelection
                ? trashItems.filter(item => selectedItems.has(item.id))
                : trashItems;

            if (itemsToRestore.length === 0) return;

            // Separate files (including papers) and folders
            const fileIds = itemsToRestore.filter(i => i.type === 'file' || i.type === 'paper').map(i => i.id);
            const folderIds = itemsToRestore.filter(i => i.type === 'folder').map(i => i.id);

            const promises = [];
            if (fileIds.length > 0) promises.push(apiClient.restoreFilesFromTrash(fileIds));
            if (folderIds.length > 0) promises.push(apiClient.restoreFoldersFromTrash(folderIds));

            const results = await Promise.all(promises);
            const allSuccessful = results.every(result => result.success);

            if (allSuccessful) {
                // Clear items from view immediately
                const restoredIds = new Set(itemsToRestore.map(i => i.id));
                setTrashItems(prev => prev.filter(item => !restoredIds.has(item.id)));
                setSelectedItems(new Set());

                // Show toast with undo option
                toast(`${itemsToRestore.length} items restored successfully`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            try {
                                // Move all items back to trash (treating papers as files)
                                const moveBackResponse = await apiClient.moveToTrash(folderIds, fileIds);

                                if (moveBackResponse.success) {
                                    toast.success(`Items moved back to trash`);
                                    refreshTrash();
                                } else {
                                    toast.error(`Failed to move items back to trash`);
                                    refreshTrash();
                                }
                            } catch (error) {
                                console.error('Move back to trash error:', error);
                                toast.error(`Failed to move items back to trash`);
                                refreshTrash();
                            }
                        },
                    },
                });
            } else {
                // Partial success - refresh to show remaining items
                await refreshTrash();
                const successCount = results.filter(result => result.success).length;
                toast.success(`${successCount} of ${promises.length} operations completed successfully`);
            }
        } catch (error) {
            console.error('Bulk restore error:', error);
            toast.error(hasSelection ? 'Failed to restore selected items' : 'Failed to restore all items');
            await refreshTrash();
        }
    };

    const handleDeleteBulk = () => {
        const hasSelection = selectedItems.size > 0;
        if (!hasSelection && trashItems.length === 0) return;

        setIsDeletingAll(!hasSelection);
        setBulkDeleteModalOpen(true);
    };

    const confirmBulkDelete = async () => {
        try {
            // Determine which items to delete
            const itemsToProcess = isDeletingAll
                ? trashItems
                : trashItems.filter(item => selectedItems.has(item.id));

            if (itemsToProcess.length === 0) return;

            // Separate files (including papers) and folders
            const fileIds = itemsToProcess.filter(item => item.type === 'file' || item.type === 'paper').map(item => item.id);
            const folderIds = itemsToProcess.filter(item => item.type === 'folder').map(item => item.id);

            // Make single unified API call using generic fileIds for papers
            const result = await apiClient.deleteFromTrash(folderIds, fileIds, []); // Pass empty array for paperIds specific arg

            if (result.success) {
                // Clear items from view immediately
                const deletedIds = new Set(itemsToProcess.map(i => i.id));
                setTrashItems(prev => prev.filter(item => !deletedIds.has(item.id)));
                setSelectedItems(prev => {
                    const next = new Set(prev);
                    deletedIds.forEach(id => next.delete(id));
                    return next;
                });

                toast.success(isDeletingAll ? `All items permanently deleted` : `${itemsToProcess.length} items permanently deleted`);
            } else {
                toast.error(result.error || 'Failed to delete items');
                await refreshTrash();
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error(isDeletingAll ? 'Failed to delete all items' : 'Failed to delete selected items');
            await refreshTrash();
        } finally {
            setBulkDeleteModalOpen(false);
            setIsDeletingAll(false);
        }
    };

    // Filter items based on search query
    const deferredQuery = React.useDeferredValue(searchQuery);
    const sortedItems = useMemo(() => {
        const filteredItems = deferredQuery
            ? trashItems.filter(item =>
                item.name.toLowerCase().includes(deferredQuery.toLowerCase())
            )
            : trashItems;

        return filteredItems.sort((a, b) => {
            // Handle different column types
            if (sortDescriptor.column === 'deletedAt') {
                const firstDate = new Date(a.deletedAt).getTime();
                const secondDate = new Date(b.deletedAt).getTime();
                return sortDescriptor.direction === "descending" ? secondDate - firstDate : firstDate - secondDate;
            }

            if (sortDescriptor.column === 'size') {
                const aSize = a.size || 0;
                const bSize = b.size || 0;
                return sortDescriptor.direction === "descending" ? bSize - aSize : aSize - bSize;
            }

            if (sortDescriptor.column === 'name') {
                const firstName = a.name || '';
                const secondName = b.name || '';
                let cmp = firstName.localeCompare(secondName);
                if (sortDescriptor.direction === "descending") {
                    cmp *= -1;
                }
                return cmp;
            }

            return 0;
        });
    }, [trashItems, sortDescriptor, deferredQuery]);

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: sortedItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50, // Estimate row height
        overscan: 5,
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle shortcuts when not typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Prevent background actions if any modal/dialog is open
            if (document.querySelector('[role="dialog"]') || document.querySelector('.radix-dialog-content')) {
                return;
            }

            // Select all (Ctrl+A)
            if (e.ctrlKey && e.key === 'a' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setSelectedItems(new Set(sortedItems.map(item => item.id)));
                return;
            }

            // Clear selection (Escape)
            if (e.key === 'Escape') {
                setSelectedItems(new Set());
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [sortedItems]);

    if (isLoading) {
        return (
            <TableSkeleton
                title="Trash"
                headerIcons={
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            className="h-8 w-8 p-0"
                        >
                            <IconRestore className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled
                            className="h-8 w-8 p-0"
                        >
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    </div>
                }
            />
        );
    }

    if (error) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title="Trash"
                    className="h-10 border-0"
                />
                <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Failed to load trash</p>
                        <p className="text-xs text-muted-foreground">{error}</p>
                    </div>
                </div>
            </TableCard.Root>
        );
    }

    return (
        <>
            <TableCard.Root size="sm">
                <TableCard.Header
                    title={
                        <div className="flex items-center gap-2">
                            <span>Trash</span>
                            <Tooltip>
                                <TooltipTrigger className="cursor-default">
                                    <IconInfoCircle className="h-4 w-4 text-muted-foreground/70 hover:text-muted-foreground transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{retentionText}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    }
                    contentTrailing={
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleRestoreBulk}
                                        disabled={trashItems.length === 0 && selectedItems.size === 0}
                                        className={`h-8 w-8 p-0 ${selectedItems.size > 0 ? 'bg-primary/10 text-primary' : ''}`}
                                        aria-label={selectedItems.size > 0 ? `Restore ${selectedItems.size} Selected` : "Restore All"}
                                    >
                                        <IconRestore className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{selectedItems.size > 0 ? `Restore ${selectedItems.size} Selected` : "Restore All"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleDeleteBulk}
                                        disabled={trashItems.length === 0 && selectedItems.size === 0}
                                        className={`h-8 w-8 p-0 text-destructive hover:text-destructive ${selectedItems.size > 0 ? 'bg-destructive/10' : 'hover:bg-destructive/10'}`}
                                        aria-label={selectedItems.size > 0 ? `Delete ${selectedItems.size} Selected` : "Delete All"}
                                    >
                                        <IconTrash className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{selectedItems.size > 0 ? `Delete ${selectedItems.size} Selected` : "Delete All"}</TooltipContent>
                            </Tooltip>
                        </div>
                    }
                    className="h-10 border-0"
                />
                {trashItems.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <IconTrashAlt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">Trash is empty</p>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={parentRef}
                        className="h-[calc(100vh-220px)] overflow-auto relative scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
                    >
                        <Table
                            aria-label="Trash"
                            selectionMode="multiple"
                            selectionBehavior="replace"
                            sortDescriptor={sortDescriptor}
                            onSortChange={setSortDescriptor}
                            selectedKeys={selectedItems}
                            onSelectionChange={(keys) => {
                                if (keys === 'all') {
                                    if (selectedItems.size > 0 && selectedItems.size < sortedItems.length) {
                                        setSelectedItems(new Set());
                                    } else {
                                        setSelectedItems(new Set(sortedItems.map(item => item.id)));
                                    }
                                } else {
                                    setSelectedItems(new Set(Array.from(keys as Set<string>)));
                                }
                            }}
                        >
                            <Table.Header className="group">
                                <Table.Head className="w-10 text-center pl-4 pr-0">
                                    <Checkbox
                                        slot="selection"
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
                                    <Table.Head id="originalLocation" allowsSorting align="left" className={`pointer-events-none cursor-default w-[180px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`}>
                                        <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Original location</span>
                                    </Table.Head>
                                )}
                                {!isMobile && (
                                    <Table.Head id="deletedAt" allowsSorting align="right" className={`pointer-events-none cursor-default min-w-[120px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`}>
                                        <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Date deleted</span>
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
                                {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start > 0 && (
                                    <Table.Row id="spacer-top" className="hover:bg-transparent border-0 focus-visible:outline-none">
                                        <Table.Cell colSpan={isMobile ? 3 : 6} style={{ height: rowVirtualizer.getVirtualItems()[0].start, padding: 0 }} />
                                    </Table.Row>
                                )}

                                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                    const item = sortedItems[virtualItem.index];
                                    return (
                                        <Table.Row
                                            key={item.id}
                                            id={item.id}
                                            data-index={virtualItem.index}
                                            ref={rowVirtualizer.measureElement}
                                            onDoubleClick={() => {
                                                if (item.type === 'paper') {
                                                    window.open('/paper/' + item.id + '?viewMode=view', '_blank');
                                                } else {
                                                    openPreviewForTrash(item.id);
                                                }
                                            }}
                                            className="group hover:bg-muted/50 transition-colors duration-150"
                                        >
                                            <Table.Cell className="w-10 text-center pl-4 pr-0">
                                                <Checkbox
                                                    slot="selection"
                                                    className={`transition-opacity duration-200 ${selectedItems.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                                />
                                            </Table.Cell>
                                            <Table.Cell className="w-full max-w-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="text-base">
                                                        {item.type === 'folder' ? (
                                                            <IconFolder className="h-4 w-4 text-blue-500 inline-block align-middle" />
                                                        ) : (
                                                            <FileThumbnail
                                                                fileId={item.id}
                                                                mimeType={item.type === 'paper' ? 'application/x-paper' : item.mimeType}
                                                                name={item.name}
                                                                className="h-4 w-4 inline-block align-middle"
                                                                iconClassName="h-4 w-4"
                                                            />
                                                        )}
                                                    </div>
                                                    <TruncatedNameTooltip
                                                        name={item.name}
                                                        className="text-sm font-medium whitespace-nowrap text-foreground cursor-default flex-1 min-w-0"
                                                    />
                                                </div>
                                            </Table.Cell>
                                            {!isMobile && (
                                                <Table.Cell className="text-muted-foreground text-sm truncate w-[180px]">
                                                    --
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right h-12">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {formatDate(item.deletedAt)}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right h-12">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {item.type === 'folder' || item.type === 'paper' ? '--' : formatFileSize(item.size || 0)}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            <Table.Cell className="px-3 h-12">
                                                <div className="flex justify-end gap-1 h-full items-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                onClick={(e) => e.stopPropagation()}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                            >
                                                                <DotsVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => handleRestoreClick(item.id, item.name, item.type)}>
                                                                <IconRestore className="h-4 w-4 mr-2" />
                                                                Restore
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => {
                                                                if (item.type === 'paper') {
                                                                    window.open('/paper/' + item.id + '?viewMode=view', '_blank');
                                                                } else if (item.filename || item.mimeType) {
                                                                    openPreviewForTrash(item.id);
                                                                } else {
                                                                    handleDetailsClick(item.id, item.name, item.type);
                                                                }
                                                            }}>
                                                                <IconEye className="h-4 w-4 mr-2" />
                                                                Preview
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDetailsClick(item.id, item.name, item.type)}>
                                                                <IconInfoCircle className="h-4 w-4 mr-2" />
                                                                Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteClick(item.id, item.name, item.type)}
                                                                variant="destructive"
                                                            >
                                                                <IconTrashAlt className="h-4 w-4 mr-2" />
                                                                Delete permanently
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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
                                                    <Table.Cell colSpan={isMobile ? 3 : 6} style={{ height: bottomSpace, padding: 0 }} />
                                                </Table.Row>
                                            );
                                        }
                                        return null;
                                    })()
                                )}
                            </Table.Body>
                        </Table>
                    </div>
                )}
            </TableCard.Root>

            <DeletePermanentlyModal
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                itemId={selectedItemForDelete?.id || ""}
                itemName={selectedItemForDelete?.name || ""}
                itemType={selectedItemForDelete?.type || "file"}
                onItemDeleted={() => {
                    setTrashItems(prevItems => prevItems.filter(item => item.id !== selectedItemForDelete?.id));
                }}
                onStorageFreed={(storageFreed) => updateStorage(-storageFreed)}
            />

            <DetailsModal
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
                itemId={selectedItemForDetails?.id || ""}
                itemName={selectedItemForDetails?.name || ""}
                itemType={selectedItemForDetails?.type || "file"}
            />

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={bulkDeleteModalOpen} onOpenChange={(open) => {
                setBulkDeleteModalOpen(open);
                if (!open) setIsDeletingAll(false);
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{isDeletingAll ? 'Delete All Items' : `Delete ${selectedItems.size} Items`}</DialogTitle>
                        <DialogDescription>
                            {isDeletingAll
                                ? "Are you sure you want to permanently delete all items in the current view? This action cannot be undone."
                                : `Are you sure you want to permanently delete the ${selectedItems.size} selected items? This action cannot be undone.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkDeleteModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmBulkDelete}>
                            {isDeletingAll ? 'Delete All' : 'Delete Selected'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FullPagePreviewModal
                isOpen={!!previewFile}
                file={previewFile ? { id: previewFile.id, name: previewFile.name, type: previewFile.type || 'file', mimeType: previewFile.mimeType, size: previewFile.size } : null}
                onClose={closePreviewTrash}
                onNavigate={navigatePreviewTrash}
                onDownload={(file) => { /* Download from trash not supported, show message */ toast.error('Download from Trash is not available'); }}
                hasPrev={previewIndex > 0}
                hasNext={previewIndex < trashItems.length - 1}
                currentIndex={previewIndex}
                totalItems={trashItems.length}
            />

            <ActionBar
                open={selectedItems.size > 0}
            >
                <ActionBarSelection>
                    {selectedItems.size} selected
                </ActionBarSelection>
                <ActionBarSeparator />
                <ActionBarGroup>
                    <ActionBarItem
                        onClick={handleRestoreBulk}
                    >
                        <IconRestore className="h-4 w-4 mr-2" />
                        Restore
                    </ActionBarItem>
                    <ActionBarItem
                        variant="destructive"
                        onClick={handleDeleteBulk}
                    >
                        <IconTrashAlt className="h-4 w-4 mr-2" />
                        Delete
                    </ActionBarItem>
                </ActionBarGroup>
                <ActionBarSeparator />
                <ActionBarClose onClick={() => setSelectedItems(new Set())}>
                    <IconX className="h-4 w-4" />
                </ActionBarClose>
            </ActionBar>
        </>
    );
};
