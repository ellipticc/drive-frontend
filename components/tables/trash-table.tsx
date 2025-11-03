"use client";

import { useMemo, useState, useEffect } from "react";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table/table";
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
import { apiClient } from "@/lib/api";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { decryptFilename } from "@/lib/crypto";
import { masterKeyManager } from "@/lib/master-key";

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
    sha256Hash?: string;
}

export const TrashTable = () => {
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "deletedAt",
        direction: "descending",
    });

    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            const [filesResponse, foldersResponse] = await Promise.all([
                apiClient.getTrashFiles(),
                apiClient.getTrashFolders()
            ]);

            if (filesResponse.success && foldersResponse.success) {
                // Get master key for filename decryption
                let masterKey: Uint8Array | null = null;
                try {
                    masterKey = masterKeyManager.getMasterKey();
                } catch (err) {
                    console.warn('Could not retrieve master key for filename decryption', err);
                }

                // Combine files and folders into a single array
                const combinedItems: TrashItem[] = [
                    ...(filesResponse.data?.files || []).map((file: any) => {
                        // Decrypt filename if both encrypted_filename and filename_salt are present
                        let displayName = file.encrypted_filename || '';
                        if (file.encryptedFilename && file.filenameSalt && masterKey) {
                            try {
                                displayName = decryptFilename(file.encryptedFilename, file.filenameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt filename for trash file ${file.id}:`, err);
                                displayName = file.encrypted_filename || '';
                            }
                        }

                        return {
                            id: file.id,
                            name: displayName,
                            filename: file.filename,
                            size: file.size,
                            mimeType: file.mimetype,
                            type: 'file' as const,
                            createdAt: file.created_at,
                            updatedAt: file.updated_at,
                            deletedAt: file.deleted_at,
                            sha256Hash: file.sha256_hash,
                        };
                    }),
                    ...(foldersResponse.data || []).map((folder: any) => ({
                        id: folder.id,
                        name: folder.name,
                        type: 'folder' as const,
                        createdAt: folder.createdAt,
                        updatedAt: folder.updatedAt,
                        deletedAt: folder.deletedAt,
                    }))
                ];
                setTrashItems(combinedItems);
            } else {
                setError('Failed to load trash items');
            }
        } catch (err) {
            // console.error('Error refreshing trash:', err);
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
                toast.success(`${itemType} restored successfully`);
            } else {
                toast.error(`Failed to restore ${itemType}`);
            }
        } catch (error) {
            // console.error('Restore error:', error);
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
            // console.error('Details error:', error);
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
                toast.success(`All ${trashItems.length} items restored successfully`);
            } else {
                // Partial success - refresh to show remaining items
                await refreshTrash();
                const successCount = results.filter(result => result.success).length;
                toast.success(`${successCount} of ${promises.length} operations completed successfully`);
            }
        } catch (error) {
            // console.error('Bulk restore error:', error);
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

            if (allSuccessful) {
                // Clear trash view immediately
                setTrashItems([]);
                toast.success(`All ${trashItems.length} items permanently deleted`);
            } else {
                // Partial success - refresh to show remaining items
                await refreshTrash();
                const successCount = results.filter(result => result.success).length;
                toast.success(`${successCount} of ${promises.length} operations completed successfully`);
            }
        } catch (error) {
            // console.error('Bulk delete error:', error);
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

        // Add ordinal suffix to day
        const day = date.getDate();
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
        return trashItems.sort((a, b) => {
            const first = a[sortDescriptor.column as keyof TrashItem];
            const second = b[sortDescriptor.column as keyof TrashItem];

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
    }, [trashItems, sortDescriptor]);

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
                    <Table aria-label="Trash" selectionMode="multiple" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor}>
                        <Table.Header>
                            <Table.Head id="name" label="Name" isRowHeader allowsSorting className="w-full max-w-1/4" />
                            <Table.Head id="deletedAt" label="Deleted" allowsSorting className="text-right" />
                            <Table.Head id="size" label="Size" allowsSorting className="text-right" />
                            <Table.Head id="actions" />
                        </Table.Header>

                        <Table.Body items={sortedItems}>
                            {(item) => (
                                <Table.Row id={item.id}>
                                    <Table.Cell>
                                        <div className="flex items-center gap-2">
                                            <div className="text-base">
                                                {getFileIcon(item.mimeType || '', item.type)}
                                            </div>
                                            <p className="text-sm font-medium whitespace-nowrap text-foreground">
                                                {item.name}
                                            </p>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        <span className="text-sm text-muted-foreground font-medium">
                                            {formatDate(item.deletedAt)}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        <span className="text-sm text-muted-foreground">
                                            {item.type === 'folder' ? '--' : formatFileSize(item.size || 0)}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell className="px-3">
                                        <div className="flex justify-end gap-1">
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
                            )}
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
                onItemDeleted={refreshTrash}
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
