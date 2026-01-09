"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconRestore, IconTrash } from "@tabler/icons-react";
const DeletePermanentlyModal = dynamic(() => import("@/components/modals/delete-permanently-modal").then(mod => mod.DeletePermanentlyModal));
const DetailsModal = dynamic(() => import("@/components/modals/details-modal").then(mod => mod.DetailsModal));
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
import { IconFolder, IconInfoCircle, IconTrash as IconTrashAlt } from "@tabler/icons-react";
import { apiClient, FileContentItem, FolderContentItem } from "@/lib/api";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { TruncatedNameTooltip } from "./truncated-name-tooltip";
import { masterKeyManager } from "@/lib/master-key";
import { decryptFilenameInWorker } from "@/lib/filename-decryption-pool";
import { useUser } from "@/components/user-context";
import { FileIcon } from "../file-icon";

interface TrashItem {
    id: string;
    name: string;
    filename?: string;
    size?: number;
    mimeType?: string;
    type: 'file' | 'folder';
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
    shaHash?: string | null;
    // Temporary fields for async decryption
    encryptedFilename?: string;
    filenameSalt?: string;
    encryptedName?: string;
    nameSalt?: string;
}

export const TrashTable = ({ searchQuery }: { searchQuery?: string }) => {
    const { updateStorage } = useUser();
    const isMobile = useIsMobile();
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "deletedAt",
        direction: "descending",
    });

    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedItemForDelete, setSelectedItemForDelete] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

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

            // Fetch both trash files and folders
            let filesResponse;
            let foldersResponse;

            try {
                [filesResponse, foldersResponse] = await Promise.all([
                    apiClient.getTrashFiles({ page, limit }),
                    apiClient.getTrashFolders({ page, limit })
                ]);
            } catch (fetchErr) {
                console.error('Error fetching trash items:', fetchErr);
                setError('Failed to load trash items');
                setIsLoading(false);
                return;
            }

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

                if (foldersResponse.data && 'pagination' in (foldersResponse.data as any)) {
                    folderPages = (foldersResponse.data as any).pagination.totalPages;
                    folderTotal = (foldersResponse.data as any).pagination.total;
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

                // Decrypt files synchronously since we have master key
                const filesData = (filesResponse.data && 'files' in filesResponse.data) ? filesResponse.data.files : [];
                const decryptedFiles = await Promise.all(
                    (filesData as unknown as FileContentItem[]).map(async (file: FileContentItem) => {
                        let decryptedName = '(Unnamed file)';

                        // Try to decrypt filename if encrypted data is available
                        if (file.encryptedFilename && file.filenameSalt) {
                            try {
                                decryptedName = await decryptFilenameInWorker(file.encryptedFilename, file.filenameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt filename for file ${file.id}:`, err);
                                decryptedName = '(Unnamed file)';
                            }
                        }

                        return {
                            id: file.id,
                            name: decryptedName || '(Unnamed file)',
                            filename: file.filename,
                            size: file.size,
                            mimeType: file.mimetype,
                            type: 'file' as const,
                            createdAt: file.created_at || file.createdAt,
                            updatedAt: file.updated_at || file.updatedAt,
                            deletedAt: file.deleted_at || file.deletedAt || '' || '',
                            shaHash: file.sha_hash || file.shaHash,
                            folderId: file.folder_id || file.folderId,
                        };
                    })
                );

                // Decrypt folders synchronously since we have master key
                const foldersData = (foldersResponse.data && 'data' in (foldersResponse.data as any)) ? (foldersResponse.data as any).data : (foldersResponse.data || []);
                const decryptedFolders = await Promise.all(
                    (foldersData as FolderContentItem[]).map(async (folder: FolderContentItem) => {
                        let decryptedName = '(Unnamed folder)';

                        // Try to decrypt folder name if encrypted data is available
                        if (folder.encryptedName && folder.nameSalt) {
                            try {
                                decryptedName = await decryptFilenameInWorker(folder.encryptedName, folder.nameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt folder name for folder ${folder.id}:`, err);
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

                // Combine all items
                // Only show folders on first page to avoid duplication, or always show them?
                // For now, always showing them as per previous behavior, but this might be weird if pagination is only for files.
                // Ideally we should probably split them or paginate better, but sticking to simple file pagination.
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

    const handleRestoreClick = async (itemId: string, itemName: string, itemType: "file" | "folder") => {
        try {
            let response;
            if (itemType === 'file') {
                response = await apiClient.restoreFileFromTrash(itemId);
            } else {
                response = await apiClient.restoreFolderFromTrash(itemId);
            }

            if (response.success) {
                // Remove the item from trash view immediately
                setTrashItems(prevItems => prevItems.filter(item => item.id !== itemId));

                // Show toast with undo option
                toast(`${itemType} restored successfully`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            try {
                                let moveBackResponse;
                                if (itemType === 'file') {
                                    moveBackResponse = await apiClient.moveFileToTrash(itemId);
                                } else {
                                    moveBackResponse = await apiClient.moveFolderToTrash(itemId);
                                }

                                if (moveBackResponse.success) {
                                    toast.success(`${itemType} moved back to trash`);
                                    refreshTrash(); // Refresh to show the item back in trash
                                } else {
                                    toast.error(`Failed to move ${itemType} back to trash`);
                                    refreshTrash(); // Refresh anyway to show current state
                                }
                            } catch (error) {
                                console.error('Move back to trash error:', error);
                                toast.error(`Failed to move ${itemType} back to trash`);
                                refreshTrash(); // Refresh anyway to show current state
                            }
                        },
                    },
                });
            } else {
                toast.error(`Failed to restore ${itemType}`);
            }
        } catch (error) {
            console.error('Restore error:', error);
            toast.error(`Failed to restore ${itemType}`);
        }
    };

    const handleDeleteClick = (itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemForDelete({ id: itemId, name: itemName, type: itemType });
        setDeleteModalOpen(true);
    };

    const handleDetailsClick = async (itemId: string, itemName: string, itemType: "file" | "folder") => {
        try {
            let response;
            if (itemType === 'file') {
                response = await apiClient.getFileInfo(itemId);
            } else {
                response = await apiClient.getFolderInfo(itemId);
            }

            if (response.success) {
                // console.log(`${itemType} details:`, response.data);
                setSelectedItemForDetails({ id: itemId, name: itemName, type: itemType });
                setDetailsModalOpen(true);
            } else {
                toast.error(`Failed to load ${itemType} details`);
            }
        } catch (error) {
            console.error('Details error:', error);
            toast.error(`Failed to load ${itemType} details`);
        }
    };

    const handleRestoreAll = async () => {
        if (trashItems.length === 0) return;

        try {
            // Separate files and folders
            const fileIds = trashItems.filter(item => item.type === 'file').map(item => item.id);
            const folderIds = trashItems.filter(item => item.type === 'folder').map(item => item.id);

            // Make bulk API calls
            const promises = [];
            if (fileIds.length > 0) {
                promises.push(apiClient.restoreFilesFromTrash(fileIds));
            }
            if (folderIds.length > 0) {
                promises.push(apiClient.restoreFoldersFromTrash(folderIds));
            }

            const results = await Promise.all(promises);
            const allSuccessful = results.every(result => result.success);

            if (allSuccessful) {
                // Clear trash view immediately
                setTrashItems([]);

                // Show toast with undo option
                toast(`All ${trashItems.length} items restored successfully`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            try {
                                // Move all items back to trash
                                const moveBackResponse = await apiClient.moveToTrash(folderIds, fileIds);

                                if (moveBackResponse.success) {
                                    toast.success(`All items moved back to trash`);
                                    refreshTrash(); // Refresh to show items back in trash
                                } else {
                                    toast.error(`Failed to move items back to trash`);
                                    refreshTrash(); // Refresh anyway to show current state
                                }
                            } catch (error) {
                                console.error('Move back to trash error:', error);
                                toast.error(`Failed to move items back to trash`);
                                refreshTrash(); // Refresh anyway to show current state
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
            toast.error('Failed to restore all items');
            await refreshTrash();
        }
    };

    const handleDeleteAll = () => {
        if (trashItems.length === 0) return;
        setBulkDeleteModalOpen(true);
    };

    const confirmBulkDelete = async () => {
        try {
            // Separate files and folders
            const fileIds = trashItems.filter(item => item.type === 'file').map(item => item.id);
            const folderIds = trashItems.filter(item => item.type === 'folder').map(item => item.id);

            // Make bulk API calls
            const promises = [];
            if (fileIds.length > 0) {
                promises.push(apiClient.deleteFilesPermanently(fileIds));
            }
            if (folderIds.length > 0) {
                promises.push(apiClient.deleteFoldersPermanently(folderIds));
            }

            const results = await Promise.all(promises);
            const allSuccessful = results.every(result => result.success);

            // Calculate total storage freed
            let totalStorageFreed = 0;
            results.forEach(result => {
                if (result.success && result.data?.storageFreed) {
                    totalStorageFreed += result.data.storageFreed;
                }
            });

            if (allSuccessful) {
                // Clear trash view immediately
                setTrashItems([]);
                toast.success(`All ${trashItems.length} items permanently deleted`);

                // Update storage instantly
                if (totalStorageFreed > 0) {
                    updateStorage(-totalStorageFreed);
                }
            } else {
                // Partial success - refresh to show remaining items
                await refreshTrash();
                const successCount = results.filter(result => result.success).length;
                toast.success(`${successCount} of ${promises.length} operations completed successfully`);

                // Still update storage for successful operations
                if (totalStorageFreed > 0) {
                    updateStorage(-totalStorageFreed);
                }
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error('Failed to delete all items');
            await refreshTrash();
        } finally {
            setBulkDeleteModalOpen(false);
        }
    };

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
                    title="Trash"
                    contentTrailing={
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleRestoreAll}
                                disabled={trashItems.length === 0}
                                className="h-8 w-8 p-0"
                                title="Restore All"
                            >
                                <IconRestore className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleDeleteAll}
                                disabled={trashItems.length === 0}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete All"
                            >
                                <IconTrash className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    }
                    className="h-10 border-0"
                />
                {trashItems.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <IconTrash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                                                            <IconFolder className="h-4 w-4 text-blue-500 inline-block" />
                                                        ) : (
                                                            <FileIcon mimeType={item.mimeType} filename={item.name} className="h-4 w-4" />
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
                                                    {/* Original Location Placeholder - Backend doesn't seem to provide this yet? It was in header though. */}
                                                    --
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right h-12">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {new Date(item.deletedAt).toLocaleString('en-US', {
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                            year: 'numeric',
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right h-12">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {item.type === 'folder' ? '--' : formatFileSize(item.size || 0)}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            <Table.Cell className="px-3 h-12">
                                                <div className="flex justify-end gap-1 h-full items-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                                <DotsVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => handleRestoreClick(item.id, item.name, item.type)}>
                                                                <IconRestore className="h-4 w-4 mr-2" />
                                                                Restore
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
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-card rounded-b-lg">
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages} ({totalItems} items)
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || isLoading}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || isLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </TableCard.Root>
            <DetailsModal
                itemId={selectedItemForDetails?.id || ""}
                itemName={selectedItemForDetails?.name || ""}
                itemType={selectedItemForDetails?.type || "file"}
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
            />

            <DeletePermanentlyModal
                itemId={selectedItemForDelete?.id || ""}
                itemName={selectedItemForDelete?.name || ""}
                itemType={selectedItemForDelete?.type || "file"}
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                onItemDeleted={() => {
                    // Remove the item from trash view immediately (optimistic update)
                    setTrashItems(prevItems => prevItems.filter(item => item.id !== selectedItemForDelete?.id));
                }}
                onStorageFreed={(storageFreed) => updateStorage(-storageFreed)}
            />

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={bulkDeleteModalOpen} onOpenChange={setBulkDeleteModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete All Items</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to permanently delete all items? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkDeleteModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmBulkDelete}>
                            Delete All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
