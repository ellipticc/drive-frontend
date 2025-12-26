"use client";

import { useMemo, useState, useEffect } from "react";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconRestore, IconTrash } from "@tabler/icons-react";
import { DeletePermanentlyModal } from "@/components/modals/delete-permanently-modal";
import { DetailsModal } from "@/components/modals/details-modal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { IconFolder, IconInfoCircle, IconTrash as IconTrashAlt } from "@tabler/icons-react";
import { IconPhoto, IconVideo, IconMusic, IconFileText, IconArchive, IconFile } from "@tabler/icons-react";
import { apiClient, FileContentItem, FolderContentItem } from "@/lib/api";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { truncateFilename } from "@/lib/utils";
import { isTextTruncated } from "@/lib/tooltip-helper";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { masterKeyManager } from "@/lib/master-key";
import { decryptFilename } from "@/lib/crypto";
import { useUser } from "@/components/user-context";

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
    shaHash?: string;
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

    // Load trash items on component mount
    useEffect(() => {
        refreshTrash();
    }, []);

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
                    apiClient.getTrashFiles(),
                    apiClient.getTrashFolders()
                ]);
            } catch (fetchErr) {
                console.error('Error fetching trash items:', fetchErr);
                setError('Failed to load trash items');
                setIsLoading(false);
                return;
            }

            if (filesResponse?.success && foldersResponse?.success) {
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
                const decryptedFiles = await Promise.all(
                    ((filesResponse.data?.files || []) as unknown as FileContentItem[]).map(async (file: FileContentItem) => {
                        let decryptedName = '(Unnamed file)';

                        // Try to decrypt filename if encrypted data is available
                        if (file.encryptedFilename && file.filenameSalt) {
                            try {
                                decryptedName = await decryptFilename(file.encryptedFilename, file.filenameSalt, masterKey);
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
                const decryptedFolders = await Promise.all(
                    ((foldersResponse.data || []) as FolderContentItem[]).map(async (folder: FolderContentItem) => {
                        let decryptedName = '(Unnamed folder)';

                        // Try to decrypt folder name if encrypted data is available
                        if (folder.encryptedName && folder.nameSalt) {
                            try {
                                decryptedName = await decryptFilename(folder.encryptedName, folder.nameSalt, masterKey);
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
                const allItems = [...decryptedFiles, ...decryptedFolders];
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

    // Format date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };

        // Add ordinal suffix helper
        const ordinalSuffix = (day: number) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };

        const formatted = date.toLocaleDateString('en-US', options);
        const parts = formatted.split(', ');
        if (parts.length >= 2) {
            const datePart = parts[0];
            const timePart = parts[1];
            // Insert ordinal suffix
            const dayMatch = datePart.match(/(\w+)\s(\d+)/);
            if (dayMatch) {
                const month = dayMatch[1];
                const dayNum = parseInt(dayMatch[2]);
                const ordinalDay = `${dayNum}${ordinalSuffix(dayNum)}`;
                return `${month} ${ordinalDay} ${date.getFullYear()}, ${timePart}`;
            }
        }
        return formatted;
    };

    // Get file icon based on mime type or type
    const getFileIcon = (mimeType: string, type: string) => {
        if (type === 'folder') return <IconFolder className="h-4 w-4 text-blue-500" />;
        if (mimeType.startsWith('image/')) return <IconPhoto className="h-4 w-4 text-green-500" />;
        if (mimeType.startsWith('video/')) return <IconVideo className="h-4 w-4 text-purple-500" />;
        if (mimeType.startsWith('audio/')) return <IconMusic className="h-4 w-4 text-orange-500" />;
        if (mimeType.includes('pdf')) return <IconFileText className="h-4 w-4 text-red-500" />;
        if (mimeType.includes('zip') || mimeType.includes('rar')) return <IconArchive className="h-4 w-4 text-yellow-500" />;
        if (mimeType.includes('text')) return <IconFileText className="h-4 w-4 text-gray-500" />;
        return <IconFile className="h-4 w-4 text-gray-500" />;
    };

    const sortedItems = useMemo(() => {
        // Filter items based on search query
        const filteredItems = searchQuery
            ? trashItems.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    }, [trashItems, sortDescriptor, searchQuery]);

    if (isLoading) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title="Trash"
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                />
                <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading trash...</p>
                    </div>
                </div>
            </TableCard.Root>
        );
    }

    if (error) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title="Trash"
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
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
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRestoreAll}
                                disabled={trashItems.length === 0}
                                className="h-8"
                            >
                                <IconRestore className="h-4 w-4 mr-2" />
                                Restore All
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleDeleteAll}
                                disabled={trashItems.length === 0}
                                className="h-8"
                            >
                                <IconTrash className="h-4 w-4 mr-2" />
                                Delete All
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={refreshTrash}
                                className="h-8"
                            >
                                Refresh
                            </Button>
                        </div>
                    }
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                />
                {trashItems.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <IconTrash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">Trash is empty</p>
                        </div>
                    </div>
                ) : (
                    <Table
                        aria-label="Trash"
                        selectionMode="multiple"
                        sortDescriptor={sortDescriptor}
                        onSortChange={setSortDescriptor}
                        selectedKeys={selectedItems}
                        onSelectionChange={(keys) => {
                            if (keys === 'all') {
                                setSelectedItems(new Set(sortedItems.map(item => item.id)));
                            } else {
                                setSelectedItems(new Set(Array.from(keys as Set<string>)));
                            }
                        }}
                    >
                        <Table.Header>
                            {selectedItems.size > 0 ? (
                                <>
                                    <Table.Head id="name" isRowHeader className="w-full max-w-1/4">
                                        <span className="text-sm font-bold text-white">{selectedItems.size} selected</span>
                                    </Table.Head>
                                    {!isMobile && <Table.Head id="deletedAt" className="text-right" />}
                                    {!isMobile && <Table.Head id="size" className="text-right" />}
                                    <Table.Head id="actions" />
                                </>
                            ) : (
                                <>
                                    <Table.Head id="name" isRowHeader allowsSorting className="w-full max-w-1/4 pointer-events-none cursor-default" align="left">
                                        <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Name</span>
                                    </Table.Head>
                                    {!isMobile && (
                                        <Table.Head id="deletedAt" allowsSorting className="text-right pointer-events-none cursor-default" align="right">
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Deleted</span>
                                        </Table.Head>
                                    )}
                                    {!isMobile && (
                                        <Table.Head id="size" allowsSorting className="text-right pointer-events-none cursor-default" align="right">
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Size</span>
                                        </Table.Head>
                                    )}
                                    <Table.Head id="actions" align="center" />
                                </>
                            )}
                        </Table.Header>

                        <Table.Body items={sortedItems}>
                            {(item) => {
                                return (
                                    <Table.Row id={item.id} className="h-12">
                                        <Table.Cell className="h-12">
                                            <div className="flex items-center gap-2 h-full">
                                                <div className="text-base flex-shrink-0">
                                                    {getFileIcon(item.mimeType || '', item.type)}
                                                </div>
                                                {isTextTruncated(item.name) ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <p className="text-xs font-medium whitespace-nowrap text-foreground truncate cursor-default flex-1 min-w-0">
                                                                {truncateFilename(item.name)}
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="text-xs text-muted-foreground max-w-xs break-words">
                                                                {item.name}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <p className="text-xs font-medium whitespace-nowrap text-foreground truncate cursor-default flex-1 min-w-0">
                                                        {item.name}
                                                    </p>
                                                )}
                                            </div>
                                        </Table.Cell>
                                        {!isMobile && (
                                            <Table.Cell className="text-right h-12">
                                                <span className="text-sm text-muted-foreground font-medium">
                                                    {formatDate(item.deletedAt)}
                                                </span>
                                            </Table.Cell>
                                        )}
                                        {!isMobile && (
                                            <Table.Cell className="text-right h-12">
                                                <span className="text-sm text-muted-foreground">
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
                            }}
                        </Table.Body>
                    </Table>
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
