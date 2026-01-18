"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useFormatter } from "@/hooks/use-formatter";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";

import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconShare3, IconListDetails, IconDownload, IconInfoCircle, IconFolder, IconX, IconGrid3x3, IconPencil, IconLinkOff, IconEye } from "@tabler/icons-react";
const ShareModal = dynamic(() => import("@/components/modals/share-modal").then(mod => mod.ShareModal));
const DetailsModal = dynamic(() => import("@/components/modals/details-modal").then(mod => mod.DetailsModal));
const RenameModal = dynamic(() => import("@/components/modals/rename-modal").then(mod => mod.RenameModal));
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import dynamic from 'next/dynamic';
const FullPagePreviewModal = dynamic(() => import('@/components/previews/full-page-preview-modal').then(m => m.FullPagePreviewModal));
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { apiClient, ShareItem } from "@/lib/api";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconLink, IconCopy } from "@tabler/icons-react";
import { decryptFilenameInWorker } from "@/lib/filename-decryption-pool";
import { useGlobalUpload } from "@/components/global-upload-context";
import { masterKeyManager } from "@/lib/master-key";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FileThumbnail } from "../files/file-thumbnail";
import { TruncatedNameTooltip } from "./truncated-name-tooltip";
import {
    ActionBar,
    ActionBarSelection,
    ActionBarGroup,
    ActionBarItem,
    ActionBarClose,
    ActionBarSeparator,
} from "@/components/ui/action-bar";

export const SharesTable = ({ searchQuery, mode = 'sent' }: { searchQuery?: string; mode?: 'sent' | 'received' }) => {
    const isMobile = useIsMobile();
    const { startFileDownload, startBulkDownload } = useGlobalUpload();
    const { formatDate } = useFormatter();

    const [menuOpenRow, setMenuOpenRow] = useState<string | null>(null);

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "createdAt",
        direction: "descending",
    });

    const [shares, setShares] = useState<ShareItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const limit = 50;

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

    // Preview state
    const [previewFile, setPreviewFile] = useState<any | null>(null);
    const [previewIndex, setPreviewIndex] = useState(-1);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const setPreviewParam = (id?: string) => {
        try {
            const params = new URLSearchParams(searchParams.toString());
            if (id) params.set('preview', id);
            else params.delete('preview');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        } catch (err) {
            // ignore
        }
    }

    const openPreviewFor = async (itemIndex: number) => {
        const item = filteredItems[itemIndex];
        if (!item) return;
        if (item.fileId || !item.isFolder) {
            const id = item.fileId || item.id;

            // Clear selection immediately to hide action bar
            setSelectedItems(new Set());

            // If we don't have mimeType or size, fetch file info
            let mimeType = item.mimeType;
            let size = (item as any).fileSize || (item as any).size;
            let name = item.fileName || '';
            if (!mimeType || !size) {
                try {
                    const res = await apiClient.getFileInfo(id);
                    if (res.success && res.data) {
                        mimeType = res.data.mimeType || mimeType;
                        size = res.data.size || size;
                        name = res.data.name || name;
                    }
                } catch (err) {
                    // ignore
                }
            }

            setPreviewFile({ id, name: name || '', type: 'file', mimeType, size });
            setPreviewIndex(itemIndex);
            setPreviewParam(id);
        }
    };
    const closePreview = () => {
        setPreviewFile(null);
        setPreviewParam(undefined);
    };
    const navigatePreview = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev' ? previewIndex - 1 : previewIndex + 1;
        if (newIndex >= 0 && newIndex < filteredItems.length) {
            const item = filteredItems[newIndex];
            if (!item) return;
            const id = item.fileId || item.id;
            setPreviewFile({ id, name: item.fileName || '', type: 'file', mimeType: item.mimeType, size: item.fileSize });
            setPreviewIndex(newIndex);
            setPreviewParam(id);
        }
    };




    // Load shares on component mount or when page/mode changes
    useEffect(() => {
        refreshShares();
    }, [page, mode]);

    // Refresh shares
    const refreshShares = async () => {
        try {
            setIsLoading(true);
            setError(null);

            let response;
            if (mode === 'received') {
                response = await apiClient.getReceivedShares();
            } else {
                response = await apiClient.getMyShares({ page, limit });
            }

            if (response.success && response.data) {
                let sharesData: ShareItem[] = [];

                if ('pagination' in response.data) {
                    sharesData = response.data.data as ShareItem[];
                    setTotalPages(response.data.pagination.totalPages);
                    setTotalItems(response.data.pagination.total);

                    // Map received shares if needed
                    if (mode === 'received') {
                        sharesData = sharesData.map((item: ShareItem) => ({
                            id: item.id,
                            fileId: item.fileId,
                            fileName: item.fileName,
                            fileSize: item.fileSize,
                            createdAt: (item as any).sharedAt || item.createdAt, // Map sharedAt to createdAt
                            permissions: item.permissions,
                            revoked: item.revoked,
                            linkSecret: item.linkSecret,
                            // Defaults for missing fields and compatibility aliases
                            views: (item as any).views ?? 0,
                            downloads: (item as any).downloads ?? 0,
                            view_count: (item as any).views ?? (item as any).view_count ?? 0,
                            download_count: (item as any).downloads ?? (item as any).download_count ?? 0,
                            folderPath: item.folderPath || '',
                            isFolder: item.isFolder || false,
                            recipients: item.recipients || [],
                            has_password: item.has_password || false,
                            // Initialize other optional ShareItem fields (snake_case and camelCase aliases)
                            mimeType: (item as any).mimeType,
                            encryptedFilename: (item as any).encryptedFilename,
                            filenameSalt: (item as any).filenameSalt,
                            encrypted_filename: (item as any).encryptedFilename ?? (item as any).encrypted_filename,
                            nonce_filename: (item as any).filenameSalt ?? (item as any).nonce_filename,
                            encrypted_foldername: (item as any).encryptedFolderName ?? (item as any).encrypted_foldername,
                            nonce_foldername: (item as any).folderPathSalt ?? (item as any).nonce_foldername,
                        })) as ShareItem[];
                    }
                } else {
                    sharesData = response.data as ShareItem[];
                    // No pagination returned (should not happen with new API)
                    setTotalPages(1);
                    setTotalItems(sharesData.length);
                }

                // Get master key for filename decryption
                let masterKey: Uint8Array | null = null;
                try {
                    masterKey = masterKeyManager.getMasterKey();
                } catch (err) {
                    console.warn('Could not retrieve master key for filename decryption', err);
                }

                // Decrypt filenames and folder paths in shares
                const sharesWithDecryptedNames = await Promise.all(sharesData.map(async (share: ShareItem) => {
                    let displayName = share.fileName || '';
                    let displayPath = share.folderPath || '';

                    if (share.encryptedFilename && share.filenameSalt && masterKey) {
                        try {
                            displayName = await decryptFilenameInWorker(share.encryptedFilename, share.filenameSalt, masterKey);
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
                                            const decryptedPart = await decryptFilenameInWorker(encryptedParts[i], saltParts[i], masterKey);
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
                    } else {
                        displayPath = 'Root'; // Default to Root if no path or no salts
                    }

                    // Trim any trailing slashes and ensure Root is the fallback
                    displayPath = displayPath.trim();
                    if (!displayPath || displayPath === '/') {
                        displayPath = 'Root';
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
                console.error(`Failed to load shares: ${errorMessage}`);
                setError(errorMessage);
            }
        } catch (err) {
            console.error('Error refreshing shares:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load shares';
            console.error(`Exception loading shares: ${errorMessage}`);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareClick = (itemId: string, itemName: string, itemType: "file" | "folder") => {
        // itemId must be the underlying fileId or folderId (not the share id)
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
            console.error('Details error:', error);
            toast.error(`Failed to load ${itemType} details`);
        }
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
            // Use global download manager (Unified Progress Manager)
            await startFileDownload(fileId, fileName);
        } catch (error) {
            console.error('Download error:', error);
            // toast error handled by context if needed, but we can log
        }
    };

    const handleRevokeShare = async (shareId: string) => {
        try {
            const response = await apiClient.disableShare(shareId);
            if (response.success) {
                toast.success('Share revoked successfully');
                refreshShares(); // Refresh the shares list
                // Clear selection so action bar will disappear
                setSelectedItems(new Set());
            } else {
                toast.error('Failed to revoke share');
            }
        } catch (error) {
            console.error('Revoke share error:', error);
            toast.error('Failed to revoke share');
        }
    };

    // Helper to find an existing share for a given resource (file/folder id)
    const findExistingShareForResource = async (resourceId: string, type: 'file' | 'folder') => {
        try {
            const response = await apiClient.getMyShares();
            if (!response.success || !response.data) return null;
            const shares = Array.isArray(response.data) ? response.data : response.data.data;
            const existingShare = shares.find((share: ShareItem) =>
                (type === 'folder' ? share.folderId === resourceId : share.fileId === resourceId) && !share.revoked
            );
            return existingShare || null;
        } catch (err) {
            console.error('Failed to lookup existing share:', err);
            return null;
        }
    };

    const handleCopyLinkForResource = async (resourceId: string, type: 'file' | 'folder') => {
        try {
            const existing = await findExistingShareForResource(resourceId, type);
            if (existing) {
                const accountSalt = masterKeyManager.getAccountSalt();
                if (!accountSalt) throw new Error('Account salt missing');
                const derivationInput = `share:${resourceId}:${accountSalt}`;
                const derivationBytes = new TextEncoder().encode(derivationInput);
                const cekHash = await crypto.subtle.digest('SHA-256', derivationBytes);
                const shareCek = new Uint8Array(cekHash);
                const shareCekHex = btoa(String.fromCharCode(...shareCek));
                const finalShareUrl = existing.has_password ? `https://drive.ellipticc.com/s/${existing.id}` : `https://drive.ellipticc.com/s/${existing.id}#${shareCekHex}`;
                await navigator.clipboard.writeText(finalShareUrl);
                toast.success('Share link copied to clipboard');
            } else {
                // No existing share - open share modal to create one
                handleShareClick(resourceId, '', type);
                setShareModalOpen(true);
            }
        } catch (err) {
            console.error('Failed to copy share link:', err);
            toast.error('Failed to copy share link');
        }
    };

    const sortedItems = useMemo(() => {
        return shares.sort((a, b) => {


            if (sortDescriptor.column === 'createdAt') {
                const firstDate = new Date(a.createdAt ?? 0).getTime();
                const secondDate = new Date(b.createdAt ?? 0).getTime();
                return sortDescriptor.direction === "descending" ? secondDate - firstDate : firstDate - secondDate;
            }

            if (sortDescriptor.column === 'downloads') {
                return sortDescriptor.direction === "descending" ? b.download_count - a.download_count : a.download_count - b.download_count;
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
    const deferredQuery = React.useDeferredValue(searchQuery);
    const filteredItems = useMemo(() => {
        if (!deferredQuery || deferredQuery.trim() === '') {
            return sortedItems;
        }

        const query = deferredQuery.toLowerCase().trim();
        return sortedItems.filter(item =>
            (item.fileName || '').toLowerCase().includes(query) ||
            (item.folderPath || '').toLowerCase().includes(query)
        );
    }, [sortedItems, deferredQuery]);

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useWindowVirtualizer({
        count: filteredItems.length,
        estimateSize: () => 50, // Estimate row height
        overscan: 5,
        scrollMargin: parentRef.current?.offsetTop ?? 0,
    });

    const handleBulkDownload = async () => {
        if (selectedItems.size === 0) return;

        try {
            const selectedShares = filteredItems.filter(item => selectedItems.has(item.id));
            const itemsToDownload = selectedShares
                .filter(s => s.fileId)
                .map(item => ({
                    id: item.fileId!,
                    name: item.fileName || '',
                    type: item.isFolder ? 'folder' as const : 'file' as const
                }));

            await startBulkDownload(itemsToDownload);

            // Clear selection after triggering bulk download
            setSelectedItems(new Set());
        } catch (error) {
            console.error('Bulk download error:', error);
            // toast.error('Bulk download failed');
        }
    };

    const handleBulkRevoke = async () => {
        if (selectedItems.size === 0) return;

        try {
            const selectedShares = Array.from(selectedItems);

            const response = await apiClient.disableShare(selectedShares);

            if (response.success) {
                const revokedCount = response.data?.revokedCount || selectedShares.length;
                const cascadedFileShares = response.data?.cascadedFileShares || 0;

                toast.success(`Revoked ${revokedCount} shares${cascadedFileShares > 0 ? ` (${cascadedFileShares} cascaded file shares)` : ''}`);
                refreshShares(); // Refresh the shares list
            } else {
                toast.error('Failed to revoke shares');
            }

            // Clear selection after bulk operation
            setSelectedItems(new Set());
        } catch (error) {
            console.error('Bulk revoke error:', error);
            toast.error('Bulk revoke failed');
        }
    };

    const renderHeaderIcons = () => {
        const selCount = selectedItems.size;
        // Get first selected item if any
        const firstSelectedId = selCount > 0 ? Array.from(selectedItems)[0] : null;
        const firstItem = firstSelectedId ? filteredItems.find(i => i.id === firstSelectedId) : null;

        // No selection - default icons (Share root + view toggle)
        if (selCount === 0) {
            return (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleShareRoot} aria-label="Share root">
                                <IconShare3 className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share</TooltipContent>
                    </Tooltip>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')} aria-label={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}>
                                {viewMode === 'table' ? <IconGrid3x3 className="h-3.5 w-3.5" /> : <IconListDetails className="h-3.5 w-3.5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}</TooltipContent>
                    </Tooltip>
                </>
            );
        }

        // Single selection - show full set
        if (selCount === 1 && firstItem) {
            const canDownload = !!firstItem.fileId;
            return (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => canDownload && handleDownloadClick(firstItem.fileId || firstItem.id, firstItem.fileId || '', firstItem.fileName || '')} aria-label="Download selected" disabled={!canDownload}>
                                <IconDownload className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedItemForRename({ id: firstItem.id, name: firstItem.fileName || '', type: firstItem.isFolder ? 'folder' : 'file' }); setRenameModalOpen(true); }} aria-label="Rename">
                                <IconPencil className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDetailsClick(firstItem.isFolder ? (firstItem.folderId || firstItem.id) : (firstItem.fileId || firstItem.id), firstItem.fileName || '', firstItem.isFolder ? 'folder' : 'file')} aria-label="Details">
                                <IconListDetails className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Details</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => (firstItem.fileId && openPreviewFor(filteredItems.findIndex(f => f.id === firstItem.id)))} aria-label="Preview" disabled={!firstItem.fileId || firstItem.isFolder}>
                                <IconEye className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Preview</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={async () => {
                                // Copy link if exists otherwise open share modal
                                const resourceId = firstItem.isFolder ? (firstItem.folderId || firstItem.id) : (firstItem.fileId || firstItem.id);
                                await handleCopyLinkForResource(resourceId, firstItem.isFolder ? 'folder' : 'file');
                            }} aria-label="Copy link">
                                <IconLink className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy link</TooltipContent>
                    </Tooltip>

                    <div className="h-5 w-px bg-border mx-1" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleShareClick(firstItem.isFolder ? (firstItem.folderId || firstItem.id) : (firstItem.fileId || firstItem.id), firstItem.fileName || '', firstItem.isFolder ? 'folder' : 'file')} aria-label="Share">
                                <IconShare3 className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRevokeShare(firstItem.id)} aria-label="Revoke share">
                                <IconLinkOff className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke</TooltipContent>
                    </Tooltip>

                    <div className="h-5 w-px bg-border mx-1" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')} aria-label={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}>
                                {viewMode === 'table' ? <IconGrid3x3 className="h-3.5 w-3.5" /> : <IconListDetails className="h-3.5 w-3.5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}</TooltipContent>
                    </Tooltip>
                </>
            );
        }

        // Multiple selection
        return (
            <>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleBulkDownload} aria-label="Download selected">
                            <IconDownload className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleBulkRevoke} aria-label="Revoke selected">
                            <IconLinkOff className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Revoke</TooltipContent>
                </Tooltip>

                {/* Keep Share, Rename, Details visible but disabled on multi-select */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled aria-label="Share (disabled for multiple)">
                            <IconShare3 className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share (disabled for multiple)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled aria-label="Rename (disabled for multiple)">
                            <IconPencil className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rename (disabled for multiple)</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled aria-label="Details (disabled for multiple)">
                            <IconListDetails className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Details (disabled for multiple)</TooltipContent>
                </Tooltip>

                <div className="h-5 w-px bg-border mx-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')} aria-label={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}>
                            {viewMode === 'table' ? <IconGrid3x3 className="h-3.5 w-3.5" /> : <IconListDetails className="h-3.5 w-3.5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}</TooltipContent>
                </Tooltip>
            </>
        );
    };

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
                setSelectedItems(new Set(filteredItems.map(item => item.id)));
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
    }, [filteredItems]);

    // Sync with URL ?preview=<id> param (runs after filteredItems is available)
    useEffect(() => {
        const previewId = searchParams?.get('preview');
        if (!previewId) return;
        const idx = filteredItems.findIndex(f => (f.fileId || f.id) === previewId || f.id === previewId);
        if (idx >= 0) {
            openPreviewFor(idx);
        } else {
            // Invalid preview param - remove it
            try {
                const params = new URLSearchParams(searchParams.toString());
                params.delete('preview');
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            } catch (err) {
                // ignore
            }
        }
    }, [searchParams, filteredItems, pathname, router]);

    if (isLoading) {
        return (
            <TableSkeleton
                title="My links"
                headerIcons={
                    <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                        {renderHeaderIcons()}
                    </div>
                }
            />
        );
    }

    if (error) {
        return (
            <TableCard.Root size="sm">
                <TableCard.Header
                    title="My links"
                    contentTrailing={
                        <div className="flex items-center gap-1">
                            {renderHeaderIcons()}
                        </div>
                    }
                    className="h-10 border-0"
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
                        <div className="flex items-center gap-1">
                            {renderHeaderIcons()}
                        </div>
                    }
                    className="h-10 border-0"
                />
                {viewMode === 'table' ? (
                    <div
                        ref={parentRef}
                        className="w-full relative"
                    >
                        <Table aria-label="Shares" selectionMode="multiple" selectionBehavior="replace" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor} selectedKeys={selectedItems} onSelectionChange={(keys) => {
                            if (keys === 'all') {
                                if (selectedItems.size > 0 && selectedItems.size < filteredItems.length) {
                                    setSelectedItems(new Set());
                                } else {
                                    setSelectedItems(new Set(filteredItems.map(item => item.id)));
                                }
                            } else {
                                setSelectedItems(new Set(Array.from(keys as Set<string>)));
                            }
                        }}
                        >
                            <Table.Header className="group sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                <Table.Head className="w-10 text-center pl-4 pr-0">
                                    <Checkbox
                                        slot="selection"
                                        className={`transition-opacity duration-200 ${selectedItems.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
                                    />
                                </Table.Head>
                                <Table.Head id="fileName" isRowHeader allowsSorting className={`w-full max-w-0 pointer-events-none cursor-default ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`} align="left">
                                    {selectedItems.size > 0 ? (
                                        <span className="text-xs font-semibold whitespace-nowrap text-foreground px-1.5 py-1">{selectedItems.size} selected</span>
                                    ) : (
                                        <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Name</span>
                                    )}
                                </Table.Head>
                                {!isMobile && (
                                    <Table.Head id="folderPath" allowsSorting align="left" className={`pointer-events-none cursor-default min-w-[120px] max-w-[200px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''}`}>
                                        <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Path</span>
                                    </Table.Head>
                                )}
                                {!isMobile && (
                                    <Table.Head id="createdAt" allowsSorting align="right" className={`pointer-events-none cursor-default min-w-[120px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''} px-4`}>
                                        <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Created at</span>
                                    </Table.Head>
                                )}
                                {!isMobile && (
                                    <Table.Head id="downloads" allowsSorting align="right" className={`pointer-events-none cursor-default min-w-[80px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''} px-4`}>
                                        <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Download Count</span>
                                    </Table.Head>
                                )}
                                {!isMobile && (
                                    <Table.Head id="expiresAt" allowsSorting align="right" className={`pointer-events-none cursor-default min-w-[120px] ${selectedItems.size > 0 ? '[&_svg]:invisible' : ''} px-4`}>
                                        <span className={`text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto ${selectedItems.size > 0 ? 'invisible' : ''}`}>Expires at</span>
                                    </Table.Head>
                                )}
                                <Table.Head id="actions" align="center" />
                            </Table.Header>

                            <Table.Body dependencies={[filteredItems, selectedItems.size, rowVirtualizer.getVirtualItems()]}>
                                {/* Top Spacer */}
                                {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start - rowVirtualizer.options.scrollMargin > 0 && (
                                    <Table.Row id="spacer-top" className="hover:bg-transparent border-0 focus-visible:outline-none">
                                        <Table.Cell colSpan={isMobile ? 3 : 7} style={{ height: rowVirtualizer.getVirtualItems()[0].start - rowVirtualizer.options.scrollMargin, padding: 0 }} />
                                    </Table.Row>
                                )}

                                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                    const item = filteredItems[virtualItem.index];
                                    return (
                                        <Table.Row
                                            key={item.id}
                                            id={item.id}
                                            data-index={virtualItem.index}
                                            ref={rowVirtualizer.measureElement}
                                            onDoubleClick={() => {
                                                if (item.fileId && !item.isFolder) {
                                                    openPreviewFor(virtualItem.index);
                                                } else {
                                                    handleDetailsClick(item.isFolder ? (item.folderId || item.id) : (item.fileId || item.id), item.fileName || '', item.isFolder ? 'folder' : 'file');
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
                                                        {item.isFolder ? (
                                                            <IconFolder className="h-4 w-4 text-blue-500 inline-block align-middle" />
                                                        ) : (
                                                            <FileThumbnail
                                                                fileId={item.fileId!}
                                                                mimeType={item.mimeType}
                                                                name={item.fileName || ''}
                                                                className="h-4 w-4 inline-block align-middle"
                                                                iconClassName="h-4 w-4"
                                                            />
                                                        )}
                                                    </div>
                                                    <TruncatedNameTooltip
                                                        name={item.fileName || ''}
                                                        className="text-sm font-medium truncate text-foreground flex-1 min-w-0"
                                                    />
                                                </div>
                                            </Table.Cell>
                                            {!isMobile && (
                                                <Table.Cell className="text-left min-w-[120px] max-w-[200px]">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap truncate block">
                                                        {item.folderPath || 'Root'}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right px-4">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {formatDate(item.createdAt)}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right px-4">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {item.download_count}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            {!isMobile && (
                                                <Table.Cell className="text-right px-4">
                                                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                                        {item.expiresAt ? formatDate(item.expiresAt) : 'Never'}
                                                    </span>
                                                </Table.Cell>
                                            )}
                                            <Table.Cell className="px-3 w-12">
                                                <div className={`flex justify-end gap-0.5 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                                                    <DropdownMenu onOpenChange={(open) => setMenuOpenRow(open ? item.id : null)}>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0"
                                                                onClick={(e) => e.stopPropagation()}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                            >
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
                                                                    <DropdownMenuItem onClick={() => item.fileId && handleDownloadClick(item.fileId, item.fileId, item.fileName || '')}>
                                                                        <IconDownload className="h-4 w-4 mr-2" />
                                                                        Download
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => item.fileId && handleShareClick(item.fileId, item.fileName || '', 'file')}>
                                                                        <IconShare3 className="h-4 w-4 mr-2" />
                                                                        Share
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => item.fileId && openPreviewFor(filteredItems.findIndex(f => f.id === item.id))}>
                                                                        <IconEye className="h-4 w-4 mr-2" />
                                                                        Preview
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => item.fileId && handleCopyLinkForResource(item.fileId || item.id, 'file')}>
                                                                        <IconCopy className="h-4 w-4 mr-2" />
                                                                        Copy link
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}
                                                            <DropdownMenuItem onClick={() => item.fileId && handleDetailsClick(item.fileId, item.fileName || '', item.isFolder ? 'folder' : 'file')}>
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
                                                    <Table.Cell colSpan={isMobile ? 3 : 7} style={{ height: bottomSpace, padding: 0 }} />
                                                </Table.Row>
                                            );
                                        }
                                        return null;
                                    })()
                                )}
                            </Table.Body>
                        </Table>
                    </div>
                ) : (
                    // Grid View
                    <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {shares.map((item) => (
                                <div
                                    key={item.id}
                                    className={`group relative bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-all duration-200 cursor-pointer ${selectedItems.has(item.id) ? 'ring-2 ring-primary bg-muted' : ''} ${menuOpenRow === item.id ? 'bg-muted/50' : ''}`}
                                    onClick={(e) => {
                                        if (e.ctrlKey || e.metaKey) {
                                            const newSelected = new Set(selectedItems);
                                            if (newSelected.has(item.id)) newSelected.delete(item.id);
                                            else newSelected.add(item.id);
                                            setSelectedItems(newSelected);
                                        } else {
                                            setSelectedItems(new Set([item.id]));
                                        }
                                    }}
                                    onDoubleClick={() => {
                                        if (item.fileId && !item.isFolder) openPreviewFor(filteredItems.findIndex(f => f.id === item.id));
                                        else handleDetailsClick(item.isFolder ? (item.folderId || item.id) : (item.fileId || item.id), item.fileName || '', item.isFolder ? 'folder' : 'file');
                                    }}
                                >
                                    <div className="flex flex-col items-center text-center space-y-2">
                                        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                isSelected={selectedItems.has(item.id)}
                                                onChange={(isSelected) => {
                                                    const newSelected = new Set(selectedItems);
                                                    if (isSelected) {
                                                        newSelected.add(item.id);
                                                    } else {
                                                        newSelected.delete(item.id);
                                                    }
                                                    setSelectedItems(newSelected);
                                                }}
                                            />
                                        </div>
                                        <div className="text-4xl w-full flex justify-center aspect-square items-center overflow-hidden rounded-md mb-2 bg-muted/20">
                                            {item.isFolder ? (
                                                <IconFolder className="h-12 w-12 text-blue-500" />
                                            ) : (
                                                <FileThumbnail
                                                    fileId={item.fileId!}
                                                    mimeType={item.mimeType}
                                                    name={item.fileName || ''}
                                                    className="w-full h-full object-cover"
                                                    iconClassName="h-12 w-12"
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 w-full">
                                            <TruncatedNameTooltip
                                                name={item.fileName || ''}
                                                className="text-sm font-medium truncate cursor-default"
                                                maxTooltipWidth="250px"
                                            />
                                            <TruncatedNameTooltip
                                                name={item.folderPath || ''}
                                                className="text-xs text-muted-foreground truncate"
                                                maxTooltipWidth="250px"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(item.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
            </TableCard.Root >



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
                        console.error('Rename error:', error);
                        toast.error(`Failed to rename ${selectedItemForRename.type}`);
                        setRenameModalOpen(false);
                        setSelectedItemForRename(null);
                    }
                }}
            />


            <FullPagePreviewModal
                isOpen={!!previewFile}
                file={previewFile ? { id: previewFile.id, name: previewFile.name, type: previewFile.type || 'file', mimeType: previewFile.mimeType, size: previewFile.size } : null}
                onClose={closePreview}
                onNavigate={navigatePreview}
                onDownload={(file) => { startFileDownload(file.id, file.name) }}
                hasPrev={previewIndex > 0}
                hasNext={previewIndex < filteredItems.length - 1}
                currentIndex={previewIndex}
                totalItems={filteredItems.length}
            />

            <ActionBar
                open={selectedItems.size > 0}
                onOpenChange={(open) => {
                    if (!open) setSelectedItems(new Set());
                }}
            >
                <ActionBarSelection>
                    {selectedItems.size} selected
                </ActionBarSelection>
                <ActionBarSeparator />
                <ActionBarGroup>
                    <ActionBarItem onClick={handleBulkDownload}>
                        <IconDownload className="h-4 w-4 mr-2" />
                        Download
                    </ActionBarItem>

                    {selectedItems.size === 1 && (() => {
                        const id = Array.from(selectedItems)[0];
                        const item = filteredItems.find(i => i.id === id);
                        if (!item) return null;
                        const resourceId = item.isFolder ? (item.folderId || item.id) : (item.fileId || item.id);
                        const canPreview = !!item.fileId && !item.isFolder;
                        return (
                            <>
                                {canPreview && (
                                    <ActionBarItem onClick={() => openPreviewFor(filteredItems.findIndex(f => f.id === item.id))}>
                                        <IconEye className="h-4 w-4 mr-2" />
                                        Preview
                                    </ActionBarItem>
                                )}
                                <ActionBarItem onClick={() => handleCopyLinkForResource(resourceId, item.isFolder ? 'folder' : 'file')}>
                                    <IconCopy className="h-4 w-4 mr-2" />
                                    Copy link
                                </ActionBarItem>
                            </>
                        )
                    })()}

                    <ActionBarItem
                        variant="destructive"
                        onClick={handleBulkRevoke}
                    >
                        <IconX className="h-4 w-4 mr-2" />
                        Revoke
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
