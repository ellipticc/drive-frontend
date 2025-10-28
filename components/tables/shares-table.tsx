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
                setShares(response.data);
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
                toast.info(`${itemType} details loaded`);
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

    // Get file icon
    const getFileIcon = () => {
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
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <IconShare3 className="h-4 w-4" />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <IconListDetails className="h-4 w-4" />
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
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <IconGrid3x3 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Grid view</TooltipContent>
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
                                            {getFileIcon()}
                                        </div>
                                        <p className="text-sm font-medium whitespace-nowrap text-foreground">
                                            {item.fileName}
                                        </p>
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
                                                <DropdownMenuItem onClick={() => handleDownloadClick(item.id, item.fileId, item.fileName)}>
                                                    <IconDownload className="h-4 w-4 mr-2" />
                                                    Download
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleShareClick(item.fileId, item.fileName, 'file')}>
                                                    <IconShare3 className="h-4 w-4 mr-2" />
                                                    Share
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleRenameClick(item.fileId, item.fileName, 'file')}>
                                                    <IconEdit className="h-4 w-4 mr-2" />
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDetailsClick(item.fileId, item.fileName, 'file')}>
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
                onRename={async (newName: string) => {
                    if (!selectedItemForRename) return;

                    try {
                        let response;
                        if (selectedItemForRename.type === 'file') {
                            response = await apiClient.renameFile(selectedItemForRename.id, newName);
                        } else {
                            response = await apiClient.renameFolder(selectedItemForRename.id, newName);
                        }

                        if (response.success) {
                            toast.success(`${selectedItemForRename.type} renamed successfully`);
                            refreshShares(); // Refresh the shares list
                        } else {
                            toast.error(`Failed to rename ${selectedItemForRename.type}`);
                        }
                    } catch (error) {
                        // console.error('Rename error:', error);
                        toast.error(`Failed to rename ${selectedItemForRename.type}`);
                    }

                    setRenameModalOpen(false);
                    setSelectedItemForRename(null);
                }}
            />
        </>
    );
};
