"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import type { Selection } from "react-aria-components";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconShare3, IconListDetails, IconDownload, IconEdit, IconInfoCircle, IconTrash, IconFile, IconFolder, IconHome, IconChevronRight, IconLoader2, IconX, IconGrid3x3 } from "@tabler/icons-react";
import { ShareModal } from "@/components/modals/share-modal";
import { DetailsModal } from "@/components/modals/details-modal";
import { RenameModal } from "@/components/modals/rename-modal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadEncryptedFileWithCEK, downloadEncryptedFile } from '@/lib/download';
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { decryptFilename } from "@/lib/crypto";
import { masterKeyManager } from "@/lib/master-key";
import { truncateFilename } from "@/lib/utils";
import { isTextTruncated } from "@/lib/tooltip-helper";

export interface ShareItem {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  expiresAt?: string;
  permissions: string;
  revoked: boolean;
  linkSecret?: string;
  views: number;
  maxViews?: number;
  downloads: number;
  folderPath: string;
  folderPathSalt: string;
  isFolder: boolean;
  recipients: Array<{
    id: string;
    userId?: string;
    email?: string;
    name?: string;
    status: string;
    createdAt: string;
    revokedAt?: string;
  }>;
}

export const SharesTable = ({ searchQuery }: { searchQuery?: string }) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "createdAt",
        direction: "descending",
    });

    const [shares, setShares] = useState<ShareItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // View mode state
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedItemForShare, setSelectedItemForShare] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [selectedItemForRename, setSelectedItemForRename] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);

    // Load shares on component mount
    useEffect(() => {
        refreshShares();
    }, []);

    // Refresh shares
    const refreshShares = async () => {
        try {
            setIsLoading(true);
            setError(null);
            // console.log('Loading shares...');
            const response = await apiClient.getMyShares();
            // console.log('Shares response:', response);
            if (response.success && response.data) {
                // Get master key for filename decryption
                let masterKey: Uint8Array | null = null;
                try {
                    masterKey = masterKeyManager.getMasterKey();
                } catch (err) {
                    console.warn('Could not retrieve master key for filename decryption', err);
                }

                // Decrypt filenames and folder paths in shares
                const sharesWithDecryptedNames = await Promise.all(response.data.map(async (share: any) => {
                    let displayName = share.fileName || '';
                    let displayPath = share.folderPath || '';

                    if (share.encryptedFilename && share.filenameSalt && masterKey) {
                        try {
                            displayName = await decryptFilename(share.encryptedFilename, share.filenameSalt, masterKey);
                        } catch (err) {
                            console.warn(`Failed to decrypt filename for share ${share.id}:`, err);
                            displayName = share.fileName || '';
                        }
                    }

                    // Decrypt folder path if it exists and we have salts
                    if (share.folderPath && share.folderPathSalt && masterKey) {
                        try {
                            const encryptedParts = share.folderPath.split('|||').filter((p: string) => p);
                            const saltParts = share.folderPathSalt.split('|||').filter((p: string) => p);
                            
                            if (encryptedParts.length > 0 && encryptedParts.length === saltParts.length) {
                                const decryptedParts = [];
                                for (let i = 0; i < encryptedParts.length; i++) {
                                    if (encryptedParts[i] && saltParts[i]) {
                                        try {
                                            const decryptedPart = await decryptFilename(encryptedParts[i], saltParts[i], masterKey);
                                            decryptedParts.push(decryptedPart);
                                        } catch (partErr) {
                                            console.warn(`Failed to decrypt folder path part ${i} for share ${share.id}:`, partErr);
                                            decryptedParts.push(encryptedParts[i]); // Keep encrypted as fallback
                                        }
                                    }
                                }
                                displayPath = decryptedParts.length > 0 ? decryptedParts.join('/') : 'Root';
                            } else if (encryptedParts.length > 0) {
                                displayPath = share.folderPath; // Keep encrypted if mismatched lengths
                            } else {
                                displayPath = 'Root'; // Empty path means root
                            }
                        } catch (err) {
                            console.warn(`Failed to decrypt folder path for share ${share.id}:`, err);
                            displayPath = share.folderPath || 'Root'; // Keep encrypted as fallback
                        }
                    } else if (!share.folderPath) {
                        displayPath = 'Root'; // Default to Root if no path
                    }

                    return {
                        ...share,
                        fileName: displayName,
                        folderPath: displayPath
                    };
                }));

                setShares(sharesWithDecryptedNames);
            } else {
                const errorMessage = response.error || 'Failed to load shares';
                // console.error(`Failed to load shares: ${errorMessage}`);
                setError(errorMessage);
            }
        } catch (err) {
            // console.error('Error refreshing shares:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load shares';
            // console.error(`Exception loading shares: ${errorMessage}`);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareClick = (itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemForShare({ id: itemId, name: itemName, type: itemType });
        setShareModalOpen(true);
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

    const handleRenameClick = (itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemForRename({ id: itemId, name: itemName, type: itemType });
        setRenameModalOpen(true);
    };

    const handleViewModeChange = (newViewMode: 'table' | 'grid') => {
        setViewMode(newViewMode);
        localStorage.setItem('sharesViewMode', newViewMode);
    };

    const handleShareRoot = () => {
        // Open share modal for root folder
        setSelectedItemForShare({ id: 'root', name: 'My Files', type: 'folder' });
        setShareModalOpen(true);
    };

    const handleDownloadClick = async (shareId: string, fileId: string, fileName: string) => {
        try {
            // For owner's shares, download using owner's keys (not share CEK)
            // The share CEK is only in the URL fragment for recipients
            const result = await downloadEncryptedFile(fileId);

            // Create download link and trigger download
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Download completed successfully');

        } catch (error) {
            // console.error('Download error:', error);
            toast.error('Download failed');
        }
    };

    const handleRevokeShare = async (shareId: string) => {
        try {
            const response = await apiClient.disableShare(shareId);
            if (response.success) {
                toast.success('Share revoked successfully');
                refreshShares(); // Refresh the shares list
            } else {
                toast.error('Failed to revoke share');
            }
        } catch (error) {
            // console.error('Revoke share error:', error);
            toast.error('Failed to revoke share');
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
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        const time = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        return `${month}/${day}/${year} ${time}`;
    };

    // Get file or folder icon
    const getItemIcon = (item: ShareItem) => {
        if (item.isFolder) {
            return <IconFolder className="h-4 w-4 text-blue-500" />;
        }
        return <IconFile className="h-4 w-4 text-gray-500" />;
    };

    const sortedItems = useMemo(() => {
        return shares.sort((a, b) => {
            const first = a[sortDescriptor.column as keyof ShareItem];
            const second = b[sortDescriptor.column as keyof ShareItem];

            if (sortDescriptor.column === 'createdAt') {
                const firstDate = new Date(a.createdAt).getTime();
                const secondDate = new Date(b.createdAt).getTime();
                return sortDescriptor.direction === "descending" ? secondDate - firstDate : firstDate - secondDate;
            }

            if (sortDescriptor.column === 'downloads') {
                return sortDescriptor.direction === "descending" ? b.downloads - a.downloads : a.downloads - b.downloads;
            }

            if (sortDescriptor.column === 'fileName') {
                const firstName = a.fileName || '';
                const secondName = b.fileName || '';
                let cmp = firstName.localeCompare(secondName);
                if (sortDescriptor.direction === "descending") {
                    cmp *= -1;
                }
                return cmp;
            }

            if (sortDescriptor.column === 'folderPath') {
                const firstPath = a.folderPath || '';
                const secondPath = b.folderPath || '';
                let cmp = firstPath.localeCompare(secondPath);
                if (sortDescriptor.direction === "descending") {
                    cmp *= -1;
                }
                return cmp;
            }

            if (sortDescriptor.column === 'expiresAt') {
                const firstDate = a.expiresAt ? new Date(a.expiresAt).getTime() : 0;
                const secondDate = b.expiresAt ? new Date(b.expiresAt).getTime() : 0;
                return sortDescriptor.direction === "descending" ? secondDate - firstDate : firstDate - secondDate;
            }

            return 0;
        });
    }, [shares, sortDescriptor]);

    // Filter items based on search query
    const filteredItems = useMemo(() => {
        if (!searchQuery || searchQuery.trim() === '') {
            return sortedItems;
        }

        const query = searchQuery.toLowerCase().trim();
        return sortedItems.filter(item =>
            item.fileName.toLowerCase().includes(query) ||
            item.folderPath.toLowerCase().includes(query)
        );
    }, [sortedItems, searchQuery]);

    const handleBulkDownload = async () => {
        if (selectedItems.size === 0) return;

        try {
            const selectedShares = filteredItems.filter(item => selectedItems.has(item.id));
            let successCount = 0;
            let errorCount = 0;

            for (const share of selectedShares) {
                try {
                    // For owner's shares, download using owner's keys (not share CEK)
                    const result = await downloadEncryptedFile(share.fileId);

                    // Create download link and trigger download
                    const url = URL.createObjectURL(result.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = result.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    successCount++;
                } catch (error) {
                    // console.error(`Failed to download ${share.fileName}:`, error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Downloaded ${successCount} of ${selectedShares.length} files`);
            }
            if (errorCount > 0) {
                toast.error(`Failed to download ${errorCount} files`);
            }

            // Clear selection after bulk operation
            setSelectedItems(new Set());
        } catch (error) {
            // console.error('Bulk download error:', error);
            toast.error('Bulk download failed');
        }
    };

    const handleBulkRevoke = async () => {
        if (selectedItems.size === 0) return;

        try {
            const selectedShares = Array.from(selectedItems);
            let successCount = 0;
            let errorCount = 0;

            for (const shareId of selectedShares) {
                try {
                    const response = await apiClient.disableShare(shareId);
                    if (response.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    // console.error(`Failed to revoke share ${shareId}:`, error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Revoked ${successCount} of ${selectedShares.length} shares`);
                refreshShares(); // Refresh the shares list
            }
            if (errorCount > 0) {
                toast.error(`Failed to revoke ${errorCount} shares`);
            }

            // Clear selection after bulk operation
            setSelectedItems(new Set());
        } catch (error) {
            // console.error('Bulk revoke error:', error);
            toast.error('Bulk revoke failed');
        }
    };

    const renderHeaderIcons = () => {
        const hasSelection = selectedItems.size > 0;

        if (!hasSelection) {
            // Default state - no selection
            return (
                <>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleShareRoot}>
                        <IconShare3 className="h-4 w-4" />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')}>
                        {viewMode === 'table' ? <IconGrid3x3 className="h-4 w-4" /> : <IconListDetails className="h-4 w-4" />}
                    </Button>
                </>
            );
        } else {
            // Selected items state - show bulk operation icons
            return (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleBulkDownload}>
                                <IconDownload className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download selected</TooltipContent>
                    </Tooltip>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleBulkRevoke}>
                                <IconX className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke selected shares</TooltipContent>
                    </Tooltip>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')}>
                                {viewMode === 'table' ? <IconGrid3x3 className="h-4 w-4" /> : <IconListDetails className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{viewMode === 'table' ? 'Grid view' : 'Table view'}</TooltipContent>
                    </Tooltip>
                </>
            );
        }
    };

    if (isLoading) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title="My links"
                    contentTrailing={
                        <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                            {renderHeaderIcons()}
                        </div>
                    }
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                />
                <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-4">
                        <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading shares...</p>
                        <div className="space-y-2 max-w-md mx-auto">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4 rounded" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4 rounded" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4 rounded" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                        </div>
                    </div>
                </div>
            </TableCard.Root>
        );
    }

    if (error) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title="My links"
                    contentTrailing={
                        <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                            {renderHeaderIcons()}
                        </div>
                    }
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                />
                <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Failed to load shares</p>
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
                    title="My links"
                    contentTrailing={
                        <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                            {renderHeaderIcons()}
                        </div>
                    }
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                />
                {viewMode === 'table' ? (
                <Table aria-label="Shares" selectionMode="multiple" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor} selectedKeys={selectedItems} onSelectionChange={(keys) => {
                    if (keys === 'all') {
                        setSelectedItems(new Set(filteredItems.map(item => item.id)));
                    } else {
                        setSelectedItems(new Set(Array.from(keys as Set<string>)));
                    }
                }}>
                    <Table.Header>
                        <Table.Head id="fileName" label="Name" isRowHeader allowsSorting className="w-full max-w-1/4" align="left" />
                        <Table.Head id="folderPath" label="Path" allowsSorting align="left" />
                        <Table.Head id="createdAt" label="Created at" allowsSorting align="left" />
                        <Table.Head id="downloads" label="Download Count" allowsSorting align="right" />
                        <Table.Head id="expiresAt" label="Expires at" allowsSorting align="left" />
                        <Table.Head id="actions" align="center" />
                    </Table.Header>

                    <Table.Body items={filteredItems}>
                        {(item) => (
                            <Table.Row
                                id={item.id}
                                className="group hover:bg-muted/50 transition-colors duration-150"
                            >
                                <Table.Cell className="w-full max-w-1/4">
                                    <div className="flex items-center gap-2">
                                        <div className="text-base">
                                            {getItemIcon(item)}
                                        </div>
                                        {isTextTruncated(item.fileName) ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p className="text-sm font-medium truncate text-foreground">
                                                        {truncateFilename(item.fileName)}
                                                    </p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {item.fileName}
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <p className="text-sm font-medium truncate text-foreground">
                                                {item.fileName}
                                            </p>
                                        )}
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="text-left">
                                    <span className="text-xs text-muted-foreground font-[var(--font-jetbrains-mono)] font-semibold tracking-wider">
                                        {item.folderPath || 'Root'}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-left">
                                    <span className="text-xs text-muted-foreground font-[var(--font-jetbrains-mono)] font-semibold tracking-wider">
                                        {formatDate(item.createdAt)}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-right">
                                    <span className="text-xs text-muted-foreground font-[var(--font-jetbrains-mono)] font-semibold">
                                        {item.downloads}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-left">
                                    <span className="text-xs text-muted-foreground font-[var(--font-jetbrains-mono)] font-semibold tracking-wider">
                                        {item.expiresAt ? formatDate(item.expiresAt) : 'Never'}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="px-3 w-12">
                                    <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                    <DotsVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {item.isFolder ? (
                                                    <>
                                                        <DropdownMenuItem onClick={() => {
                                                            // Open folder share in new tab
                                                            window.open(`/s/${item.id}`, '_blank');
                                                        }}>
                                                            <IconShare3 className="h-4 w-4 mr-2" />
                                                            Open Share
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </>
                                                ) : (
                                                    <>
                                                        <DropdownMenuItem onClick={() => handleDownloadClick(item.id, item.fileId, item.fileName)}>
                                                            <IconDownload className="h-4 w-4 mr-2" />
                                                            Download
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleShareClick(item.fileId, item.fileName, 'file')}>
                                                            <IconShare3 className="h-4 w-4 mr-2" />
                                                            Share
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </>
                                                )}
                                                <DropdownMenuItem onClick={() => handleDetailsClick(item.fileId, item.fileName, item.isFolder ? 'folder' : 'file')}>
                                                    <IconInfoCircle className="h-4 w-4 mr-2" />
                                                    Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleRevokeShare(item.id)} variant="destructive">
                                                    <IconX className="h-4 w-4 mr-2" />
                                                    Revoke share
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            ) : (
                // Grid View
                <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {shares.map((item) => (
                            <div
                                key={item.id}
                                className="group relative bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                                onClick={() => handleDetailsClick(item.fileId, item.fileName, item.isFolder ? 'folder' : 'file')}
                            >
                                <div className="flex flex-col items-center text-center space-y-2">
                                    <div className="text-2xl">
                                        {getItemIcon(item)}
                                    </div>
                                    <div className="flex-1 min-w-0 w-full">
                                        <p className="text-sm font-medium truncate" title={item.fileName}>
                                            {item.fileName}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate" title={item.folderPath}>
                                            {item.folderPath}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            </TableCard.Root>

            <ShareModal
                itemId={selectedItemForShare?.id || ""}
                itemName={selectedItemForShare?.name || ""}
                itemType={selectedItemForShare?.type || "file"}
                open={shareModalOpen}
                onOpenChange={setShareModalOpen}
            />

            <DetailsModal
                itemId={selectedItemForDetails?.id || ""}
                itemName={selectedItemForDetails?.name || ""}
                itemType={selectedItemForDetails?.type || "file"}
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
            />

            <RenameModal
                itemName={selectedItemForRename?.name || ""}
                itemType={selectedItemForRename?.type || "file"}
                open={renameModalOpen}
                onOpenChange={setRenameModalOpen}
                onRename={async (data: string | {
                    manifestHash: string;
                    manifestCreatedAt: number;
                    manifestSignatureEd25519: string;
                    manifestPublicKeyEd25519: string;
                    manifestSignatureDilithium: string;
                    manifestPublicKeyDilithium: string;
                    algorithmVersion: string;
                    nameHmac: string;
                    encryptedFilename?: string;
                    filenameSalt?: string;
                    encryptedName?: string;
                    nameSalt?: string;
                }) => {
                    if (!selectedItemForRename) return;

                    try {
                        let response;
                        if (typeof data === 'string') {
                            throw new Error('Expected manifest object for rename');
                        }
                        
                        // Check if this is a file manifest (has encryptedFilename) or folder manifest (has encryptedName)
                        if ('encryptedFilename' in data && data.encryptedFilename) {
                            // File manifest
                            response = await apiClient.renameFile(selectedItemForRename.id, data as unknown as {
                                encryptedFilename: string;
                                filenameSalt: string;
                                manifestHash: string;
                                manifestCreatedAt: number;
                                manifestSignatureEd25519: string;
                                manifestPublicKeyEd25519: string;
                                manifestSignatureDilithium: string;
                                manifestPublicKeyDilithium: string;
                                algorithmVersion: string;
                                nameHmac: string;
                            });
                        } else if ('encryptedName' in data && data.encryptedName) {
                            // Folder manifest
                            response = await apiClient.renameFolder(selectedItemForRename.id, data as unknown as {
                                encryptedName: string;
                                nameSalt: string;
                                manifestHash: string;
                                manifestCreatedAt: number;
                                manifestSignatureEd25519: string;
                                manifestPublicKeyEd25519: string;
                                manifestSignatureDilithium: string;
                                manifestPublicKeyDilithium: string;
                                algorithmVersion?: string;
                                nameHmac: string;
                            });
                        } else {
                            throw new Error('Invalid manifest data: missing encrypted name fields');
                        }

                        if (response.success) {
                            toast.success(`${selectedItemForRename.type} renamed successfully`);
                            refreshShares(); // Refresh the shares list
                            setRenameModalOpen(false);
                            setSelectedItemForRename(null);
                        } else {
                            // Check if this is a 409 conflict error
                            const isConflict = response.error?.toLowerCase().includes('409') || 
                                             response.error?.toLowerCase().includes('conflict') ||
                                             response.error?.toLowerCase().includes('already exists');
                            
                            if (isConflict) {
                                toast.error('A file or folder with this name already exists');
                                // Keep modal open for user to try a different name
                            } else {
                                toast.error(`Failed to rename ${selectedItemForRename.type}`);
                                setRenameModalOpen(false);
                                setSelectedItemForRename(null);
                            }
                        }
                    } catch (error) {
                        // console.error('Rename error:', error);
                        toast.error(`Failed to rename ${selectedItemForRename.type}`);
                        setRenameModalOpen(false);
                        setSelectedItemForRename(null);
                    }
                }}
            />
        </>
    );
};
