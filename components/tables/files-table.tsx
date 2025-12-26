"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor, Selection } from "react-aria-components";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconFolderPlus, IconFolderDown, IconFileUpload, IconShare3, IconListDetails, IconDownload, IconFolder, IconEdit, IconInfoCircle, IconTrash, IconPhoto, IconVideo, IconMusic, IconFileText, IconArchive, IconFile, IconHome, IconChevronRight, IconLoader2, IconLink, IconEye, IconLayoutColumns, IconChevronDown } from "@tabler/icons-react";
import { CreateFolderModal } from "@/components/modals/create-folder-modal";
import { MoveToFolderModal } from "@/components/modals/move-to-folder-modal";
import { ShareModal } from "@/components/modals/share-modal";
import { SharePickerModal } from "@/components/modals/share-picker-modal";
import { DetailsModal } from "@/components/modals/details-modal";
import { MoveToTrashModal } from "@/components/modals/move-to-trash-modal";
import { RenameModal } from "@/components/modals/rename-modal";
import { ConflictModal } from "@/components/modals/conflict-modal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, FileItem, FolderContentItem, FileContentItem } from "@/lib/api";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PreviewModal } from "@/components/previews";
import { useCurrentFolder } from "@/components/current-folder-context";
import { useOnFileAdded, useOnFileDeleted, useOnFileReplaced, useGlobalUpload } from "@/components/global-upload-context";
import { decryptFilename } from "@/lib/crypto";
import { masterKeyManager } from "@/lib/master-key";
import { truncateFilename } from "@/lib/utils";
import { isTextTruncated } from "@/lib/tooltip-helper";
import { useIsMobile } from "@/hooks/use-mobile";

export const Table01DividerLineSm = ({
    searchQuery,
    onFileUpload,
    onFolderUpload,
    dragDropFiles,
    onDragDropProcessed,
    onUploadHandlersReady
}: {
    searchQuery?: string
    onFileUpload?: () => void
    onFolderUpload?: () => void
    dragDropFiles?: { files: File[], folders: FileList | File[] | null }
    onDragDropProcessed?: () => void
    onFileInputRef?: (ref: HTMLInputElement | null) => void
    onFolderInputRef?: (ref: HTMLInputElement | null) => void
    onUploadHandlersReady?: (handlers: { handleFileUpload: () => void; handleFolderUpload: () => void }) => void
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const STORAGE_KEY = 'files-table-visible-columns';

    // Column visibility state
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['modified', 'size', 'checksum', 'shared']));
    const [isPreferencesLoaded, setIsPreferencesLoaded] = useState(false);

    // Load preferences from local storage
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setVisibleColumns(new Set(parsed));
                }
            } catch (e) {
                console.error("Failed to parse visible columns preference", e);
            }
        }
        setIsPreferencesLoaded(true);
    }, []);

    // Save preferences to local storage
    useEffect(() => {
        if (isPreferencesLoaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)));
        }
    }, [visibleColumns, isPreferencesLoaded]);

    // Global upload context
    const {
        startUploadWithFiles,
        startUploadWithFolders,
        startFileDownload,
        startFolderDownload,
        startBulkDownload,
        startPdfPreview
    } = useGlobalUpload();

    // Current folder context
    const { setCurrentFolderId: setGlobalCurrentFolderId } = useCurrentFolder();

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "modified",
        direction: "descending",
    });

    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create a memoized map for efficient file lookups
    const filesMap = useMemo(() => {
        const map = new Map<string, FileItem>();
        files.forEach(file => map.set(file.id, file));
        return map;
    }, [files]);



    // Folder navigation state
    const [currentFolderId, setCurrentFolderId] = useState<string>('root');
    const [folderPath, setFolderPath] = useState<Array<{ id: string, name: string }>>([{ id: 'root', name: 'My Files' }]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // View mode state
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Save view mode to localStorage when it changes
    const handleViewModeChange = useCallback((newViewMode: 'table' | 'grid') => {
        setViewMode(newViewMode);
        localStorage.setItem('viewMode', newViewMode);
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Update global current folder context when local folder changes
    useEffect(() => {
        setGlobalCurrentFolderId(currentFolderId === 'root' ? null : currentFolderId);
    }, [currentFolderId, setGlobalCurrentFolderId]);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [selectedItemForRename, setSelectedItemForRename] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);

    // Rename conflict state
    const [renameConflictOpen, setRenameConflictOpen] = useState(false);
    const [renameConflictItems, setRenameConflictItems] = useState<Array<{ id: string; name: string; type: 'file' | 'folder'; existingPath: string; newPath: string; existingItem?: FileItem; existingFileId?: string }>>([]);
    const [pendingRenameManifest, setPendingRenameManifest] = useState<{
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
        requestedName?: string;
    } | null>(null);
    const [renameModalInitialName, setRenameModalInitialName] = useState<string | undefined>(undefined);

    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedItemForShare, setSelectedItemForShare] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [sharePickerModalOpen, setSharePickerModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [moveToFolderModalOpen, setMoveToFolderModalOpen] = useState(false);
    const [selectedItemsForMoveToFolder, setSelectedItemsForMoveToFolder] = useState<Array<{ id: string; name: string; type: "file" | "folder" }>>([]);
    const [moveToTrashModalOpen, setMoveToTrashModalOpen] = useState(false);
    const [selectedItemForMoveToTrash] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);

    // Preview modal state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [selectedItemForPreview, setSelectedItemForPreview] = useState<{ id: string; name: string; mimeType?: string } | null>(null);

    // Handle unified file preview
    const handlePreviewClick = useCallback(async (itemId: string, itemName: string, mimeType?: string) => {
        if (!mimeType || !canPreviewFile(mimeType)) {
            toast.error('This file type cannot be previewed');
            return;
        }

        // Special handling for PDFs - use unified progress modal and auto-open in new tab
        if (mimeType.includes('pdf')) {
            const item = filesMap.get(itemId);
            if (!item || !item.size) {
                toast.error('File information not available');
                return;
            }

            await startPdfPreview(itemId, itemName, item.size);
            return;
        }

        // For all other file types, use the modal preview
        // Prevent multiple preview modals
        if (previewModalOpen) {
            setPreviewModalOpen(false);
            setTimeout(() => {
                setSelectedItemForPreview({ id: itemId, name: itemName, mimeType });
                setPreviewModalOpen(true);
            }, 100);
        } else {
            setSelectedItemForPreview({ id: itemId, name: itemName, mimeType });
            setPreviewModalOpen(true);
        }
    }, [previewModalOpen, setPreviewModalOpen, setSelectedItemForPreview, toast, filesMap, startPdfPreview]);

    // Hash copy animation state
    const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        isOpen: boolean;
        targetItem?: FileItem;
    } | null>(null);

    // Parse URL path to get folder navigation
    const parseUrlPath = (path: string): string[] => {
        // Remove leading slash and split by '/'
        const segments = path.replace(/^\//, '').split('/').filter(Boolean);
        return segments;
    };

    // Build URL path from folder path
    const buildUrlPath = (folderPath: Array<{ id: string, name: string }>): string => {
        if (folderPath.length <= 1) return '/';
        return '/' + folderPath.slice(1).map(f => f.id).join('/');
    };

    // Truncate breadcrumb names that are too long (encrypted names)
    const truncateBreadcrumbName = (name: string, maxLength: number = 20): string => {
        if (name.length <= maxLength) return name;
        // For long encrypted names, show start and end with ellipsis
        const startLen = Math.ceil(maxLength / 2 - 2);
        const endLen = Math.floor(maxLength / 2 - 2);
        return name.substring(0, startLen) + '...' + name.substring(name.length - endLen);
    };

    // Update URL when folder navigation changes
    const updateUrl = (newFolderPath: Array<{ id: string, name: string }>) => {
        const urlPath = buildUrlPath(newFolderPath);
        router.replace(urlPath, { scroll: false });
    };

    // Initialize folder navigation from URL
    useEffect(() => {
        if (!isInitialLoad) return;

        const urlSegments = parseUrlPath(pathname);
        // console.log(`URL parsing: pathname="${pathname}", segments:`, urlSegments);

        if (urlSegments.length === 0) {
            // Root folder
            // console.log('Loading root folder');
            setCurrentFolderId('root');
            setFolderPath([{ id: 'root', name: 'My Files' }]);
            setIsInitialLoad(false);
            // Load files for root folder
            refreshFiles('root');
            return;
        }

        // Build folder path from URL segments
        const buildFolderPathFromUrl = async () => {
            try {
                const currentPath = [{ id: 'root', name: 'My Files' }];
                let currentId = 'root';

                for (const segment of urlSegments) {
                    if (segment === 'root') continue;

                    // console.log(`Getting info for folder: ${segment}`);
                    // Get folder info to get the name
                    const response = await apiClient.getFolderInfo(segment);
                    // console.log(`Folder info response for ${segment}:`, response);

                    if (response.success && response.data) {
                        // Decrypt folder name if encrypted fields are present
                        let displayName = response.data.name || '';
                        if (response.data.encryptedName && response.data.nameSalt) {
                            try {
                                const masterKey = masterKeyManager.getMasterKey();
                                displayName = await decryptFilename(response.data.encryptedName, response.data.nameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt folder name for breadcrumb ${segment}:`, err);
                                // Fall back to encrypted name if decryption fails
                                displayName = response.data.name || response.data.encryptedName;
                            }
                        }

                        // console.log(`Folder ${segment} found: ${displayName}`);
                        currentPath.push({ id: segment, name: displayName });
                        currentId = segment;
                    } else {
                        // Invalid folder ID, redirect to root
                        // console.warn(`Invalid folder ID in URL: ${segment}, response:`, response);
                        router.replace('/', { scroll: false });
                        setCurrentFolderId('root');
                        setFolderPath([{ id: 'root', name: 'My Files' }]);
                        setIsInitialLoad(false);
                        // Load files for root folder
                        await refreshFiles('root');
                        return;
                    }
                }

                // console.log(`Setting folder path:`, currentPath);
                setCurrentFolderId(currentId);
                setFolderPath(currentPath);
                setIsInitialLoad(false);

                // Load files for the current folder
                // console.log(`Loading contents for folder: ${currentId}`);
                await refreshFiles(currentId);
            } catch {
                console.error('Error parsing URL path:', error);
                // On error, redirect to root
                router.replace('/', { scroll: false });
                setCurrentFolderId('root');
                setFolderPath([{ id: 'root', name: 'My Files' }]);
                setIsInitialLoad(false);
                // Load files for root folder
                await refreshFiles('root');
            }
        };

        buildFolderPathFromUrl();
    }, [pathname, isInitialLoad, router]);

    // Start file uploads with progress tracking
    const startUploads = async (files: File[]) => {
        // Use global upload context
        startUploadWithFiles(files, currentFolderId === 'root' ? null : currentFolderId);
    };

    // Start folder uploads with progress tracking (similar to file uploads but with folder hierarchy)
    const startFolderUploads = async (files: FileList | File[]) => {
        // If files is a File[] array (from drag & drop), we need to pass it directly
        // The startUploadWithFolders can handle both FileList and File[] since File[] has the webkitRelativePath property
        startUploadWithFolders(files, currentFolderId === 'root' ? null : currentFolderId);
    };

    // Handle drag and drop files
    useEffect(() => {
        if (dragDropFiles) {
            const { files, folders } = dragDropFiles;
            if (files.length > 0) {
                startUploads(files);
            }
            if (folders) {
                startFolderUploads(folders);
            }
            // Notify parent that we've processed the drag drop files
            onDragDropProcessed?.();
        }
    }, [dragDropFiles, onDragDropProcessed]);

    // Register for file added events to add files and folders incrementally
    useOnFileAdded(useCallback((fileData: FileItem) => {

        // Check if this is a folder or a file
        if (fileData.type === 'folder') {
            // Handle folder - it should appear in the current folder view
            const folderInCurrentFolder = fileData && (
                (currentFolderId === 'root' && fileData.parentId === null) ||
                (currentFolderId !== 'root' && fileData.parentId === currentFolderId)
            );

            if (folderInCurrentFolder) {
                // Use plaintext name directly from callback
                const displayName = fileData.name || '(Unnamed)';

                const newFolder: FileItem = {
                    id: fileData.id,
                    name: displayName,
                    parentId: fileData.parentId,
                    path: fileData.path,
                    type: 'folder' as const,
                    createdAt: fileData.createdAt || new Date().toISOString(),
                    updatedAt: fileData.updatedAt || new Date().toISOString(),
                    is_shared: fileData.is_shared || false
                };

                // Add folder to beginning of list
                setFiles(prev => [newFolder, ...prev]);
            }
        } else {
            // Handle file - existing logic
            // Add the newly uploaded file to the current file list incrementally
            // Handle: null folderId === 'root' currentFolderId case
            const fileInCurrentFolder = fileData && (
                (currentFolderId === 'root' && fileData.folderId === null) ||
                (currentFolderId !== 'root' && fileData.folderId === currentFolderId)
            );
            if (fileInCurrentFolder) {
                // Start with a default display name
                const displayName = `File ${fileData.id.substring(0, 8)}`; // Default fallback

                // Add to beginning of files list immediately with default name
                const newFile: FileItem = {
                    id: fileData.id,
                    name: displayName,
                    filename: fileData.filename,
                    encryptedFilename: fileData.encryptedFilename,
                    filenameSalt: fileData.filenameSalt,
                    size: fileData.size,
                    mimeType: fileData.mimeType,
                    folderId: fileData.folderId,
                    type: 'file' as const,
                    createdAt: fileData.createdAt || new Date().toISOString(),
                    updatedAt: fileData.updatedAt || new Date().toISOString(),
                    shaHash: fileData.shaHash,
                    is_shared: fileData.is_shared || false
                };

                // Add to beginning of files list for visibility
                setFiles(prev => [newFile, ...prev]);

                // Asynchronously decrypt the filename and update the file
                if (fileData.encryptedFilename && fileData.filenameSalt) {
                    (async () => {
                        try {
                            const masterKey = masterKeyManager.getMasterKey();
                            const decryptedName = await decryptFilename(fileData.encryptedFilename!, fileData.filenameSalt!, masterKey);
                            // Update the file with the decrypted name
                            setFiles(prev => prev.map(file =>
                                file.id === fileData.id
                                    ? { ...file, name: decryptedName }
                                    : file
                            ));
                        } catch (err) {
                            console.warn(`Failed to decrypt filename for newly uploaded file ${fileData.id}:`, err);
                            // Keep the default fallback name
                        }
                    })();
                }
            }
        }
    }, [currentFolderId]));

    // Register for file deleted events to remove files incrementally
    useOnFileDeleted(useCallback((fileId: string) => {

        // Remove the file from the current file list
        setFiles(prev => prev.filter(file => file.id !== fileId));
    }, []));

    const refreshFiles = useCallback(async (folderId: string = currentFolderId) => {
        try {
            setIsLoading(true);
            setError(null);
            // console.log(`Loading folder contents for: ${folderId}`);
            const response = await apiClient.getFolderContents(folderId);
            // console.log(`Folder contents response:`, response);
            if (response.success && response.data) {
                // Get master key for filename decryption
                let masterKey: Uint8Array | null = null;
                try {
                    masterKey = masterKeyManager.getMasterKey();
                } catch (err) {
                    console.warn('Could not retrieve master key for filename decryption', err);
                }

                // Combine folders and files into a single array
                const combinedItems: FileItem[] = [
                    ...(await Promise.all((response.data.folders || []).map(async (folder: FolderContentItem) => {
                        // Use plaintext name if available, only decrypt if necessary
                        let displayName = folder.name || '';

                        // Only decrypt if plaintext name is not available
                        if (!displayName && folder.encryptedName && folder.nameSalt && masterKey) {
                            try {
                                displayName = await decryptFilename(folder.encryptedName, folder.nameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt folder name for folder ${folder.id}:`, err);
                                // Fall back to showing partial encrypted name with ellipsis
                                displayName = folder.encryptedName?.substring(0, 20) + '...' || '(Unnamed)';
                            }
                        }

                        // Final fallback
                        if (!displayName) {
                            displayName = folder.encryptedName || '(Unnamed)';
                        }

                        return {
                            id: folder.id,
                            name: displayName,
                            parentId: folder.parentId,
                            path: folder.path,
                            type: 'folder' as const,
                            createdAt: folder.createdAt,
                            updatedAt: folder.updatedAt,
                            is_shared: folder.is_shared || false
                        };
                    }))),
                    ...(await Promise.all((response.data.files || []).map(async (file: FileContentItem) => {
                        // Use plaintext name if available, only decrypt if necessary
                        let displayName = file.filename || '';

                        // Only decrypt if plaintext name is not available
                        if (!displayName && file.encryptedFilename && file.filenameSalt && masterKey) {
                            try {
                                displayName = await decryptFilename(file.encryptedFilename, file.filenameSalt, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt filename for file ${file.id}:`, err);
                                // Fall back to showing partial encrypted name with ellipsis
                                displayName = file.encryptedFilename?.substring(0, 20) + '...' || '(Unnamed)';
                            }
                        }

                        // Final fallback
                        if (!displayName) {
                            displayName = file.encryptedFilename || '(Unnamed)';
                        }

                        return {
                            id: file.id,
                            name: displayName,
                            filename: file.filename,
                            encryptedFilename: file.encryptedFilename,
                            filenameSalt: file.filenameSalt,
                            size: file.size,
                            mimeType: file.mimeType,
                            folderId: file.folderId,
                            type: 'file' as const,
                            createdAt: file.createdAt,
                            updatedAt: file.updatedAt,
                            shaHash: file.shaHash,
                            is_shared: file.is_shared || false
                        };
                    })))
                ];
                // console.log(`Loaded ${combinedItems.length} items`);
                setFiles(combinedItems);
            } else {
                // Handle API errors
                const errorMessage = response.error || 'Failed to load files';
                // console.error(`Failed to load folder contents: ${errorMessage}`);
                if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
                    setError(`Folder not found or access denied. Redirecting to root folder...`);
                    // Redirect to root after a short delay
                    setTimeout(() => {
                        router.replace('/', { scroll: false });
                        setCurrentFolderId('root');
                        setFolderPath([{ id: 'root', name: 'My Files' }]);
                    }, 2000);
                } else {
                    setError(errorMessage);
                }
            }
        } catch (err) {
            // console.error('Error refreshing files:', err);
            // Handle network errors or other exceptions
            const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
            // console.error(`Exception loading folder contents: ${errorMessage}`);
            if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('access denied') || errorMessage.includes('forbidden')) {
                setError(`Folder not found or access denied. Redirecting to root folder...`);
                setTimeout(() => {
                    router.replace('/', { scroll: false });
                    setCurrentFolderId('root');
                    setFolderPath([{ id: 'root', name: 'My Files' }]);
                }, 2000);
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentFolderId, apiClient, router]);

    // Register for file replaced events to refresh the file list
    useOnFileReplaced(useCallback(() => {

        // Refresh the current folder contents
        refreshFiles();
    }, [refreshFiles]));

    // Navigate to a folder
    const navigateToFolder = async (folderId: string, folderName: string) => {
        const newPath = [...folderPath, { id: folderId, name: folderName }];
        setCurrentFolderId(folderId);
        setFolderPath(newPath);
        updateUrl(newPath);
        setSelectedItems(new Set()); // Clear selection when navigating to new folder
    };

    // Navigate to parent folder
    const navigateToParent = async () => {
        if (folderPath.length > 1) {
            const newPath = folderPath.slice(0, -1);
            const parentFolder = newPath[newPath.length - 1];
            setCurrentFolderId(parentFolder.id);
            setFolderPath(newPath);
            updateUrl(newPath);
        }
    };

    // Navigate to specific folder in path
    const navigateToPath = async (folderId: string) => {
        const folderIndex = folderPath.findIndex(f => f.id === folderId);
        if (folderIndex !== -1) {
            const newPath = folderPath.slice(0, folderIndex + 1);
            setCurrentFolderId(folderId);
            setFolderPath(newPath);
            updateUrl(newPath);
            setSelectedItems(new Set()); // Clear selection when navigating to new folder
        }
    };

    const handleFileUpload = useCallback(() => {
        if (onFileUpload) {
            onFileUpload()
        } else {
            fileInputRef.current?.click();
        }
    }, [onFileUpload]);

    const handleFolderUpload = useCallback(() => {
        if (onFolderUpload) {
            onFolderUpload()
        } else {
            folderInputRef.current?.click();
        }
    }, [onFolderUpload]);

    // Provide upload handlers to parent component
    useEffect(() => {
        if (onUploadHandlersReady) {
            onUploadHandlersReady({
                handleFileUpload,
                handleFolderUpload
            });
        }
    }, [onUploadHandlersReady, handleFileUpload, handleFolderUpload]);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            await startUploads(Array.from(selectedFiles));
        }
        // Reset the input value so the same file can be selected again
        event.target.value = "";
    };

    const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            await startFolderUploads(selectedFiles);
        }
        // Reset the input value so the same folder can be selected again
        event.target.value = "";
    };

    const handleRenameClick = useCallback((itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemForRename({ id: itemId, name: itemName, type: itemType });
        setRenameModalOpen(true);
    }, [setSelectedItemForRename, setRenameModalOpen]);

    const handleShareClick = useCallback((itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemForShare({ id: itemId, name: itemName, type: itemType });
        setShareModalOpen(true);
    }, [setSelectedItemForShare, setShareModalOpen]);

    const handleDetailsClick = useCallback(async (itemId: string, itemName: string, itemType: "file" | "folder") => {
        try {
            let response;
            if (itemType === 'file') {
                response = await apiClient.getFileInfo(itemId);
            } else {
                response = await apiClient.getFolderInfo(itemId);
            }

            if (response.success) {
                // console.log(`${itemType} details:`, response.data);
                // Here you would open a details modal with the information
                setSelectedItemForDetails({ id: itemId, name: itemName, type: itemType });
                setDetailsModalOpen(true);
            } else {
                toast.error(`Failed to load ${itemType} details`);
            }
        } catch (error) {
            console.error('Details error:', error);
            toast.error(`Failed to load ${itemType} details`);
        }
    }, [apiClient, toast, setSelectedItemForDetails, setDetailsModalOpen]);

    const handleMoveToFolderClick = (itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemsForMoveToFolder([{ id: itemId, name: itemName, type: itemType }]);
        setMoveToFolderModalOpen(true);
    };

    const handleMoveToTrashClick = async (itemId: string, itemName: string, itemType: "file" | "folder") => {
        try {
            let response;
            if (itemType === 'file') {
                response = await apiClient.moveFileToTrash(itemId);
            } else {
                response = await apiClient.moveFolderToTrash(itemId);
            }

            if (response.success) {
                // Check if the current folder is being trashed - if so, navigate to parent
                if (itemType === 'folder' && itemId === currentFolderId) {
                    navigateToParent();
                }

                // Remove the item from the current view immediately
                setFiles(prevFiles => prevFiles.filter(file => file.id !== itemId));

                // Clear selection for this item
                setSelectedItems(prevSelected => {
                    const newSelected = new Set(prevSelected);
                    newSelected.delete(itemId);
                    return newSelected;
                });

                // Show toast with undo option
                toast("Item moved to trash", {
                    action: {
                        label: "Cancel",
                        onClick: async () => {
                            try {
                                let restoreResponse;
                                if (itemType === 'file') {
                                    restoreResponse = await apiClient.restoreFileFromTrash(itemId);
                                } else {
                                    restoreResponse = await apiClient.restoreFolderFromTrash(itemId);
                                }

                                if (restoreResponse.success) {
                                    toast.success(`${itemType} restored successfully`);
                                    refreshFiles(); // Refresh to show the restored item
                                } else {
                                    toast.error(`Failed to restore ${itemType}`);
                                    refreshFiles(); // Refresh anyway to show current state
                                }
                            } catch (err) {
                                console.error('Restore error:', err);
                                toast.error(`Failed to restore ${itemType}`);
                                refreshFiles(); // Refresh anyway to show current state
                            }
                        },
                    },
                });
            } else {
                toast.error(`Failed to move ${itemType} to trash`);
            }
        } catch (error) {
            console.error('Move to trash error:', error);
            toast.error(`Failed to move ${itemType} to trash`);
        }
    };

    // Bulk move to trash handler
    const handleBulkMoveToTrash = useCallback(async () => {
        const selectedItemsArray = Array.from(selectedItems).map(id => {
            const item = filesMap.get(id);
            return item ? { id: item.id, name: item.name, type: item.type } : null;
        }).filter(Boolean) as Array<{ id: string, name: string, type: "file" | "folder" }>;

        if (selectedItemsArray.length === 0) return;

        try {
            // Separate files and folders
            const fileIds = selectedItemsArray.filter(item => item.type === 'file').map(item => item.id);
            const folderIds = selectedItemsArray.filter(item => item.type === 'folder').map(item => item.id);

            // Use unified bulk API for both files and folders
            const response = await apiClient.moveToTrash(folderIds, fileIds);

            if (response.success) {
                // Check if the current folder is being trashed - if so, navigate to parent
                if (folderIds.includes(currentFolderId)) {
                    navigateToParent();
                }

                // Remove successfully moved items from the current view
                setFiles(prevFiles => prevFiles.filter(file =>
                    !selectedItemsArray.some(selected => selected.id === file.id)
                ));

                // Clear selection for all items
                setSelectedItems(new Set());

                // Show success toast
                toast(`${selectedItemsArray.length} item${selectedItemsArray.length > 1 ? 's' : ''} moved to trash`, {
                    action: {
                        label: "Cancel",
                        onClick: async () => {
                            // Restore all moved items
                            if (fileIds.length > 0) {
                                await apiClient.restoreFilesFromTrash(fileIds);
                            }
                            if (folderIds.length > 0) {
                                await apiClient.restoreFoldersFromTrash(folderIds);
                            }
                            refreshFiles();
                        },
                    },
                });

                // No need to refreshFiles() here since we already did optimistic updates
            } else {
                toast.error(`Failed to move items to trash`);
            }
        } catch {
            // console.error('Bulk move to trash error:', error);
            toast.error(`Failed to move items to trash`);
        }
    }, [selectedItems, apiClient, setFiles, setSelectedItems, toast, refreshFiles, currentFolderId, navigateToParent]);

    // Check if a file can be previewed
    const canPreviewFile = (mimeType: string): boolean => {
        if (!mimeType) return false;
        return (
            mimeType.includes('pdf') ||
            mimeType.startsWith('audio/') ||
            mimeType.startsWith('video/') ||
            mimeType.startsWith('image/') ||
            mimeType.startsWith('text/') ||
            mimeType.includes('javascript') ||
            mimeType.includes('json') ||
            mimeType.includes('xml') ||
            mimeType.includes('css') ||
            mimeType.includes('html')
        );
    };



    // Handle file download (single item or folder)
    const handleDownloadClick = async (itemId: string, itemName: string, itemType: "file" | "folder") => {
        if (itemType === 'folder') {
            // Download folder as ZIP
            await startFolderDownload(itemId, itemName);
            toast.success('Folder downloaded successfully as ZIP');
        } else {
            // Download single file
            await startFileDownload(itemId, itemName);
            toast.success('Download completed successfully');
        }
    };


    // Handle bulk download of selected items
    const handleBulkDownload = useCallback(async () => {
        const selectedItemsArray = Array.from(selectedItems).map(id => {
            const item = filesMap.get(id);
            return item ? { id: item.id, name: item.name, type: item.type } : null;
        }).filter(Boolean) as Array<{ id: string, name: string, type: "file" | "folder" }>;

        if (selectedItemsArray.length === 0) return;

        // If only one item is selected, download it directly (no ZIP for single files)
        if (selectedItemsArray.length === 1) {
            const item = selectedItemsArray[0];
            await handleDownloadClick(item.id, item.name, item.type);
            return;
        }

        // Multiple items selected - create ZIP
        await startBulkDownload(selectedItemsArray);
        toast.success(`Downloaded ${selectedItemsArray.length} items successfully`);
    }, [selectedItems, handleDownloadClick, startBulkDownload, toast]);

    // Handle folder double-click navigation
    const handleFolderDoubleClick = async (folderId: string, folderName: string) => {
        await navigateToFolder(folderId, folderName);
    };

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, item?: FileItem) => {
        e.preventDefault();
        e.stopPropagation();

        // Single selection: clear all previous selections and select only the right-clicked item
        if (item) {
            setSelectedItems(new Set([item.id]));
        }

        // If context menu is already open, just update its position and target without closing/reopening
        if (contextMenu?.isOpen) {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                isOpen: true,
                targetItem: item
            });
        } else {
            // Context menu is not open, open it normally
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                isOpen: true,
                targetItem: item
            });
        }
    };

    const handleContextMenuClose = () => {
        setContextMenu(null);
    };

    // Context menu action handlers
    const handleContextMenuAction = (action: string, item?: FileItem) => {
        if (!item) {
            // Empty space actions
            switch (action) {
                case 'createFolder':
                    // Trigger create folder modal
                    const createFolderButton = document.querySelector('[data-create-folder-trigger]') as HTMLElement;
                    if (createFolderButton) {
                        createFolderButton.click();
                    }
                    break;
                case 'importFile':
                    handleFileUpload();
                    break;
                case 'importFolder':
                    handleFolderUpload();
                    break;
                case 'share':
                    setSharePickerModalOpen(true);
                    break;
            }
        } else {
            // Item actions
            switch (action) {
                case 'download':
                    handleDownloadClick(item.id, item.name, item.type);
                    break;
                case 'preview':
                    if (item.type === 'file' && item.mimeType && canPreviewFile(item.mimeType)) {
                        handlePreviewClick(item.id, item.name, item.mimeType);
                    }
                    break;
                case 'copyLink':
                    // TODO: Implement copy link functionality
                    toast.info('Copy link functionality coming soon');
                    break;
                case 'share':
                    handleShareClick(item.id, item.name, item.type);
                    break;
                case 'moveToFolder':
                    handleMoveToFolderClick(item.id, item.name, item.type);
                    break;
                case 'rename':
                    handleRenameClick(item.id, item.name, item.type);
                    break;
                case 'details':
                    handleDetailsClick(item.id, item.name, item.type);
                    break;
                case 'moveToTrash':
                    handleMoveToTrashClick(item.id, item.name, item.type);
                    break;
            }
        }
        handleContextMenuClose();
    };

    const handleRename = async (data: string | ({
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
        requestedName?: string;
    })) => {
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
                refreshFiles(); // Refresh the file list
                setRenameModalOpen(false);
                setSelectedItemForRename(null);
            } else {
                // Check if this is a 409 conflict error
                const isConflict = response.error?.toLowerCase().includes('409') ||
                    response.error?.toLowerCase().includes('conflict') ||
                    response.error?.toLowerCase().includes('already exists');

                if (isConflict) {
                    // If it's a folder rename conflict, show conflict modal with details
                    if (selectedItemForRename?.type === 'folder') {
                        const requestedName = data?.requestedName || '';
                        // Try to locate the existing folder in the current listing
                        const existingFolder = files.find(f => f.type === 'folder' && f.name === requestedName);

                        const conflictItem = {
                            id: selectedItemForRename.id,
                            name: requestedName,
                            type: 'folder' as const,
                            existingPath: existingFolder?.path || '',
                            newPath: '',
                            existingItem: existingFolder,
                            existingFileId: existingFolder?.id,
                        };

                        setPendingRenameManifest(data);
                        setRenameConflictItems([conflictItem]);
                        setRenameConflictOpen(true);
                        // Keep rename modal open so user can adjust if they chose to ignore
                    } else {
                        // For files keep the current behavior
                        toast.error('A file or folder with this name already exists');
                    }
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
    };

    // Handle rename conflict resolutions
    const handleRenameConflictResolution = async (resolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'>) => {
        for (const [itemId, resolution] of Object.entries(resolutions)) {
            const conflict = renameConflictItems.find(c => c.id === itemId);
            if (!conflict) continue;

            if (resolution === 'replace') {
                if (!conflict.existingFileId) {
                    toast.error('Failed to locate existing folder to replace');
                    continue;
                }

                // Delete existing folder (soft delete)
                const delResp = await apiClient.deleteFolder(conflict.existingFileId);
                if (!delResp.success) {
                    toast.error(delResp.error || 'Failed to delete existing folder');
                    continue;
                }

                // Retry rename using pending manifest
                if (!pendingRenameManifest) {
                    toast.error('Pending rename data not available');
                    continue;
                }

                const response = await apiClient.renameFolder(conflict.id, pendingRenameManifest as {
                    encryptedName: string;
                    nameSalt: string;
                    manifestHash: string;
                    manifestCreatedAt: number;
                    manifestSignatureEd25519: string;
                    manifestPublicKeyEd25519: string;
                    manifestSignatureDilithium: string;
                    manifestPublicKeyDilithium: string;
                    algorithmVersion: string;
                    nameHmac: string;
                });
                if (response.success) {
                    toast.success('Folder renamed successfully');
                    // Close modals and refresh
                    setRenameConflictOpen(false);
                    setRenameModalOpen(false);
                    setSelectedItemForRename(null);
                    refreshFiles();
                } else {
                    toast.error(response.error || 'Failed to rename folder after replacing existing one');
                }
            } else if (resolution === 'keepBoth') {
                // Suggest a unique name and reopen rename modal pre-filled with it
                const base = conflict.name;
                let idx = 1;
                const exists = (name: string) => files.some(f => f.type === 'folder' && f.name === name);
                let suggested = `${base} (${idx})`;
                while (exists(suggested)) {
                    idx += 1;
                    suggested = `${base} (${idx})`;
                }

                setRenameConflictOpen(false);
                setRenameModalOpen(true);
                setRenameModalInitialName(suggested);
            } else if (resolution === 'ignore') {
                // Just close conflict modal and leave rename modal open for user to try a different name
                setRenameConflictOpen(false);
            }
        }

        // Clear pending state
        setPendingRenameManifest(null);
        setRenameConflictItems([]);
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
        return [...files].sort((a, b) => {
            // Handle different column types
            if (sortDescriptor.column === 'modified') {
                const firstDate = new Date(a.createdAt).getTime();
                const secondDate = new Date(b.createdAt).getTime();
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

            if (sortDescriptor.column === 'checksum') {
                const firstHash = a.shaHash || '';
                const secondHash = b.shaHash || '';
                let cmp = firstHash.localeCompare(secondHash);
                if (sortDescriptor.direction === "descending") {
                    cmp *= -1;
                }
                return cmp;
            }

            return 0;
        });
    }, [files, sortDescriptor]);

    // Filter items based on search query
    const filteredItems = useMemo(() => {
        if (!searchQuery || searchQuery.trim() === '') {
            return sortedItems;
        }

        const query = searchQuery.toLowerCase().trim();
        return sortedItems.filter(item =>
            item.name.toLowerCase().includes(query)
        );
    }, [sortedItems, searchQuery]);



    const renderHeaderIcons = useMemo(() => {
        const hasSelection = selectedItems.size > 0;
        const selectedCount = selectedItems.size;
        const hasMultipleSelection = selectedCount > 1;

        const customizeColumnsDropdown = !isMobile && viewMode === 'table' ? (
            <>
                <div className="h-5 w-px bg-border mx-1" />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Customize columns">
                            <IconLayoutColumns className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuCheckboxItem
                            checked={visibleColumns.has('modified')}
                            onCheckedChange={(checked) => {
                                setVisibleColumns(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add('modified');
                                    else next.delete('modified');
                                    return next;
                                });
                            }}
                        >
                            Modified
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={visibleColumns.has('size')}
                            onCheckedChange={(checked) => {
                                setVisibleColumns(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add('size');
                                    else next.delete('size');
                                    return next;
                                });
                            }}
                        >
                            Size
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={visibleColumns.has('checksum')}
                            onCheckedChange={(checked) => {
                                setVisibleColumns(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add('checksum');
                                    else next.delete('checksum');
                                    return next;
                                });
                            }}
                        >
                            Checksum
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={visibleColumns.has('shared')}
                            onCheckedChange={(checked) => {
                                setVisibleColumns(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add('shared');
                                    else next.delete('shared');
                                    return next;
                                });
                            }}
                        >
                            Shared
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </>
        ) : null;

        if (!hasSelection) {
            // Default state - no selection
            return (
                <>
                    <CreateFolderModal
                        parentId={currentFolderId === 'root' ? null : currentFolderId}
                        onFolderCreated={() => refreshFiles()}
                    >
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Create new folder">
                            <IconFolderPlus className="h-4 w-4" />
                        </Button>
                    </CreateFolderModal>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={handleFolderUpload}
                        title="Upload folder"
                    >
                        <IconFolderDown className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={handleFileUpload}
                        title="Upload file"
                    >
                        <IconFileUpload className="h-4 w-4" />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                            // Open Share Picker Modal when no files are selected
                            setSharePickerModalOpen(true);
                        }}
                        title="Share files"
                    >
                        <IconShare3 className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')}
                        title={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}
                    >
                        <IconListDetails className="h-4 w-4" />
                    </Button>
                    {customizeColumnsDropdown}
                </>
            );
        } else {
            // Selected items state
            return (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={handleBulkDownload}
                        title={`Download ${selectedCount} item${selectedCount > 1 ? 's' : ''}`}
                    >
                        <IconDownload className="h-4 w-4" />
                    </Button>
                    {selectedCount === 1 && (() => {
                        const firstItemId = Array.from(selectedItems)[0];
                        const firstItem = filesMap.get(firstItemId);
                        return firstItem?.type === 'file' && firstItem?.mimeType && canPreviewFile(firstItem.mimeType) ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handlePreviewClick(firstItem.id, firstItem.name, firstItem.mimeType)}
                                title="Preview file"
                            >
                                <IconEye className="h-4 w-4" />
                            </Button>
                        ) : null;
                    })()}
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={hasMultipleSelection}
                        onClick={() => {
                            if (!hasMultipleSelection) {
                                const firstItemId = Array.from(selectedItems)[0];
                                const firstItem = filesMap.get(firstItemId);
                                if (firstItem) {
                                    handleShareClick(firstItem.id, firstItem.name, firstItem.type);
                                }
                            }
                        }}
                        title={hasMultipleSelection ? "Share not available for multiple items" : "Share"}
                    >
                        <IconShare3 className="h-4 w-4" />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                            // Handle bulk move to folder
                            const selectedItemsArray = Array.from(selectedItems).map(id => {
                                const item = filesMap.get(id);
                                return item ? { id: item.id, name: item.name, type: item.type } : null;
                            }).filter(Boolean) as Array<{ id: string, name: string, type: "file" | "folder" }>;

                            if (selectedItemsArray.length > 0) {
                                setSelectedItemsForMoveToFolder(selectedItemsArray);
                                setMoveToFolderModalOpen(true);
                            }
                        }}
                        title="Move to folder"
                    >
                        <IconFolder className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={hasMultipleSelection}
                        onClick={() => {
                            if (!hasMultipleSelection) {
                                const firstItemId = Array.from(selectedItems)[0];
                                const firstItem = filesMap.get(firstItemId);
                                if (firstItem) {
                                    handleRenameClick(firstItem.id, firstItem.name, firstItem.type);
                                }
                            }
                        }}
                        title={hasMultipleSelection ? "Rename not available for multiple items" : "Rename"}
                    >
                        <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={hasMultipleSelection}
                        onClick={() => {
                            if (!hasMultipleSelection) {
                                const firstItemId = Array.from(selectedItems)[0];
                                const firstItem = filesMap.get(firstItemId);
                                if (firstItem) {
                                    handleDetailsClick(firstItem.id, firstItem.name, firstItem.type);
                                }
                            }
                        }}
                        title={hasMultipleSelection ? "Details not available for multiple items" : "Details"}
                    >
                        <IconInfoCircle className="h-4 w-4" />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={handleBulkMoveToTrash}
                        title="Move to trash"
                    >
                        <IconTrash className="h-4 w-4" />
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleViewModeChange(viewMode === 'table' ? 'grid' : 'table')}
                        title={viewMode === 'table' ? 'Switch to grid view' : 'Switch to table view'}
                    >
                        <IconListDetails className="h-4 w-4" />
                    </Button>
                    {customizeColumnsDropdown}
                </>
            );
        }
    }, [selectedItems, filesMap, viewMode, currentFolderId, refreshFiles, handleFolderUpload, handleFileUpload, handleBulkDownload, handlePreviewClick, handleShareClick, handleBulkMoveToTrash, handleViewModeChange, handleRenameClick, handleDetailsClick, setSharePickerModalOpen, setSelectedItemsForMoveToFolder, setMoveToFolderModalOpen, visibleColumns, isMobile]);

    // Memoize the onSelectionChange callback to prevent unnecessary re-renders
    const handleTableSelectionChange = useCallback((keys: Selection) => {
        if (keys === 'all') {
            const allIds = filteredItems.map(item => item.id);
            setSelectedItems(prev => {
                if (prev.size === allIds.length && allIds.every(id => prev.has(id))) {
                    return prev; // No change needed
                }
                return new Set(allIds);
            });
        } else {
            const newKeys = Array.from(keys as Set<string>);
            setSelectedItems(prev => {
                if (prev.size === newKeys.length && newKeys.every(id => prev.has(id))) {
                    return prev; // No change needed
                }
                return new Set(newKeys);
            });
        }
    }, [filteredItems]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle shortcuts when not typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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

            // Preview selected file (Space or Enter)
            if ((e.key === ' ' || e.key === 'Enter') && selectedItems.size === 1) {
                e.preventDefault();
                const firstItemId = Array.from(selectedItems)[0];
                const firstItem = filesMap.get(firstItemId);
                if (firstItem?.type === 'file' && firstItem?.mimeType && canPreviewFile(firstItem.mimeType)) {
                    handlePreviewClick(firstItem.id, firstItem.name, firstItem.mimeType);
                } else if (firstItem?.type === 'folder') {
                    handleFolderDoubleClick(firstItem.id, firstItem.name);
                }
                return;
            }

            // Download selected items (Ctrl+D)
            if (e.ctrlKey && e.key === 'd' && !e.shiftKey && !e.altKey && selectedItems.size > 0) {
                e.preventDefault();
                handleBulkDownload();
                return;
            }

            // Delete selected items (Delete or Backspace)
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.size > 0) {
                e.preventDefault();
                handleBulkMoveToTrash();
                return;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedItems, filesMap]);

    if (isLoading) {
        return (
            <>
                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card h-12 flex-shrink-0">
                    <IconHome className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-1 text-sm">
                        {folderPath.map((folder, index) => (
                            <div key={folder.id} className="flex items-center gap-1">
                                {index > 0 && <IconChevronRight className="h-3 w-3 text-muted-foreground" />}
                                <button
                                    onClick={() => navigateToPath(folder.id)}
                                    className={`hover:text-primary transition-colors ${index === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                                        }`}
                                    disabled={index === folderPath.length - 1}
                                    title={folder.name}
                                >
                                    {truncateBreadcrumbName(folder.name)}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <TableCard.Root size="sm">
                    <TableCard.Header
                        title="My Files"
                        contentTrailing={
                            <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                                <CreateFolderModal>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                        <IconFolderPlus className="h-4 w-4" />
                                    </Button>
                                </CreateFolderModal>
                                <div className="h-5 w-px bg-border mx-1" />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={handleFolderUpload}
                                >
                                    <IconFolderDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={handleFileUpload}
                                >
                                    <IconFileUpload className="h-4 w-4" />
                                </Button>
                                <div className="h-5 w-px bg-border mx-1" />
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <IconShare3 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <IconListDetails className="h-4 w-4" />
                                </Button>
                            </div>
                        }
                        className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                    />
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center space-y-4">
                            <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading files...</p>
                            {/* Skeleton rows for better UX */}
                            <div className="space-y-2 max-w-md mx-auto">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            </div>
                        </div>
                    </div>
                </TableCard.Root>
            </>
        );
    }

    if (error) {
        return (
            <>
                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card h-12 flex-shrink-0">
                    <IconHome className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-1 text-sm">
                        {folderPath.map((folder, index) => (
                            <div key={folder.id} className="flex items-center gap-1">
                                {index > 0 && <IconChevronRight className="h-3 w-3 text-muted-foreground" />}
                                <button
                                    onClick={() => navigateToPath(folder.id)}
                                    className={`hover:text-primary transition-colors ${index === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                                        }`}
                                    disabled={index === folderPath.length - 1}
                                    title={folder.name}
                                >
                                    {truncateBreadcrumbName(folder.name)}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <TableCard.Root size="sm">
                    <TableCard.Header
                        title="My Files"
                        contentTrailing={
                            <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                                <CreateFolderModal>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                        <IconFolderPlus className="h-4 w-4" />
                                    </Button>
                                </CreateFolderModal>
                                <div className="h-5 w-px bg-border mx-1" />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={handleFolderUpload}
                                >
                                    <IconFolderDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={handleFileUpload}
                                >
                                    <IconFileUpload className="h-4 w-4" />
                                </Button>
                                <div className="h-5 w-px bg-border mx-1" />
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <IconShare3 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                    <IconListDetails className="h-4 w-4" />
                                </Button>
                            </div>
                        }
                        className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                    />
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-2">Failed to load files</p>
                            <p className="text-xs text-muted-foreground">{error}</p>
                        </div>
                    </div>
                </TableCard.Root>
            </>
        );
    }

    return (
        <>
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card h-12 flex-shrink-0">
                <IconHome className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-1 text-sm">
                    {folderPath.map((folder, index) => (
                        <div key={folder.id} className="flex items-center gap-1">
                            {index > 0 && <IconChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <button
                                onClick={() => navigateToPath(folder.id)}
                                className={`hover:text-primary transition-colors ${index === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                                    }`}
                                disabled={index === folderPath.length - 1}
                                title={folder.name}
                            >
                                {truncateBreadcrumbName(folder.name)}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <TableCard.Root size="sm">
                <TableCard.Header
                    title="My Files"
                    contentTrailing={
                        <div className="absolute top-1 right-4 md:right-6 flex items-center gap-1">
                            {renderHeaderIcons}

                            {/* Hidden file inputs */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                                accept="*/*"
                            />
                            <input
                                ref={folderInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFolderSelect}
                                {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                            />
                        </div>
                    }
                    className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
                />
                {viewMode === 'table' ? (
                    <Table aria-label="Files" selectionMode="multiple" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor} selectedKeys={selectedItems} onSelectionChange={handleTableSelectionChange}
                        onContextMenu={(e) => handleContextMenu(e)}
                    >
                        <Table.Header>
                            {selectedItems.size > 0 ? (
                                <>
                                    <Table.Head id="name" isRowHeader allowsSorting className="w-full max-w-1/4" align="left">
                                        <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer">Name</span>
                                    </Table.Head>
                                    {!isMobile && (
                                        <Table.Head id="modified" allowsSorting align="left" className={`${visibleColumns.has('modified') ? '' : '[&>*]:invisible'} pointer-events-none cursor-default`}>
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Modified</span>
                                        </Table.Head>
                                    )}
                                    {!isMobile && (
                                        <Table.Head id="size" allowsSorting align="right" className={`${visibleColumns.has('size') ? '' : '[&>*]:invisible'} pointer-events-none cursor-default`}>
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Size</span>
                                        </Table.Head>
                                    )}
                                    {!isMobile && (
                                        <Table.Head id="checksum" allowsSorting align="right" className={`pr-2 ${visibleColumns.has('checksum') ? '' : '[&>*]:invisible'} pointer-events-none cursor-default`}>
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Checksum</span>
                                        </Table.Head>
                                    )}
                                    <Table.Head id="shared" align="center" className={`w-8 ${visibleColumns.has('shared') ? '' : '[&>*]:invisible pointer-events-none'}`} />
                                    <Table.Head id="actions" align="center" />
                                </>
                            ) : (
                                <>
                                    <Table.Head id="name" isRowHeader allowsSorting className="w-full max-w-1/4 pointer-events-none cursor-default" align="left">
                                        <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Name</span>
                                    </Table.Head>
                                    {!isMobile && (
                                        <Table.Head id="modified" allowsSorting align="left" className={`${visibleColumns.has('modified') ? '' : '[&>*]:invisible'} pointer-events-none cursor-default`}>
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Modified</span>
                                        </Table.Head>
                                    )}
                                    {!isMobile && (
                                        <Table.Head id="size" allowsSorting align="right" className={`${visibleColumns.has('size') ? '' : '[&>*]:invisible'} pointer-events-none cursor-default`}>
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Size</span>
                                        </Table.Head>
                                    )}
                                    {!isMobile && (
                                        <Table.Head id="checksum" allowsSorting align="right" className={`pr-2 ${visibleColumns.has('checksum') ? '' : '[&>*]:invisible'} pointer-events-none cursor-default`}>
                                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-1.5 py-1 transition-colors cursor-pointer pointer-events-auto">Checksum</span>
                                        </Table.Head>
                                    )}
                                    <Table.Head id="shared" label="" align="center" className={`w-8 ${visibleColumns.has('shared') ? '' : '[&>*]:invisible pointer-events-none'}`} />
                                    <Table.Head id="actions" align="center" />
                                </>
                            )}
                        </Table.Header>

                        <Table.Body items={filteredItems} dependencies={[visibleColumns]}>
                            {(item) => (
                                <Table.Row
                                    id={item.id}
                                    onDoubleClick={item.type === 'folder' ? () => handleFolderDoubleClick(item.id, item.name) : (item.type === 'file' && item.mimeType && canPreviewFile(item.mimeType) ? () => handlePreviewClick(item.id, item.name, item.mimeType) : undefined)}
                                    className="group hover:bg-muted/50 transition-colors duration-150"
                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                >
                                    <Table.Cell className="w-full max-w-1/4">
                                        <div className="flex items-center gap-2">
                                            <div className="text-base">
                                                {getFileIcon(item.mimeType || '', item.type)}
                                            </div>
                                            {isTextTruncated(item.name) ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <p className="text-sm font-medium whitespace-nowrap text-foreground truncate cursor-default">
                                                            {truncateFilename(item.name)}
                                                        </p>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{item.name}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <p className="text-sm font-medium whitespace-nowrap text-foreground truncate cursor-default">
                                                    {item.name}
                                                </p>
                                            )}
                                        </div>
                                    </Table.Cell>
                                    {!isMobile && (
                                        <Table.Cell className={`text-left ${visibleColumns.has('modified') ? '' : '[&>*]:invisible'}`}>
                                            <span className="text-xs text-muted-foreground font-mono break-all">
                                                {formatDate(item.createdAt)}
                                            </span>
                                        </Table.Cell>
                                    )}
                                    {!isMobile && (
                                        <Table.Cell className={`text-right ${visibleColumns.has('size') ? '' : '[&>*]:invisible'}`}>
                                            <span className="text-xs text-muted-foreground font-mono break-all">
                                                {item.type === 'folder' ? '--' : formatFileSize(item.size || 0)}
                                            </span>
                                        </Table.Cell>
                                    )}
                                    {!isMobile && (
                                        <Table.Cell className={`text-right ${visibleColumns.has('checksum') ? '' : '[&>*]:invisible'}`}>
                                            {item.type === 'folder' ? (
                                                <span className="text-xs text-muted-foreground font-mono break-all">N/A</span>
                                            ) : item.shaHash ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono break-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(item.shaHash!);
                                                                setCopiedHashId(item.id);
                                                                setTimeout(() => setCopiedHashId(null), 300);
                                                            }}
                                                        >
                                                            {item.shaHash.substring(0, 5)}...{item.shaHash.substring(item.shaHash.length - 5)}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        className="max-w-none whitespace-nowrap font-[var(--font-jetbrains-mono)] font-semibold tracking-wider"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(item.shaHash!);
                                                            setCopiedHashId(item.id);
                                                            setTimeout(() => setCopiedHashId(null), 500);
                                                        }}
                                                    >
                                                        <p className={`text-xs cursor-pointer transition-all duration-300 ${copiedHashId === item.id ? 'animate-pulse bg-primary/20 text-primary scale-105' : ''}`}>{item.shaHash}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <span className="text-xs text-muted-foreground font-mono break-all">N/A</span>
                                            )}
                                        </Table.Cell>
                                    )}
                                    <Table.Cell className={`px-1 w-8 ${visibleColumns.has('shared') ? '' : '[&>*]:invisible'}`}>
                                        {/* Shared icon */}
                                        {item.is_shared ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShareClick(item.id, item.name, item.type);
                                                        }}
                                                        className="flex items-center justify-center cursor-pointer hover:bg-accent rounded-sm p-1 transition-colors"
                                                    >
                                                        <IconShare3 className="h-3.5 w-3.5 text-blue-500 opacity-70 hover:opacity-100 transition-opacity" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Manage share</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : null}
                                    </Table.Cell>
                                    <Table.Cell className="px-3 w-12">
                                        <div className={`flex justify-end gap-0.5 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                        <DotsVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => handleDownloadClick(item.id, item.name, item.type)}>
                                                        <IconDownload className="h-4 w-4 mr-2" />
                                                        Download
                                                    </DropdownMenuItem>
                                                    {item.type === 'file' && item.mimeType && canPreviewFile(item.mimeType) && (
                                                        <DropdownMenuItem onClick={() => handlePreviewClick(item.id, item.name, item.mimeType)}>
                                                            <IconEye className="h-4 w-4 mr-2" />
                                                            Preview
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => handleShareClick(item.id, item.name, item.type)}>
                                                        <IconShare3 className="h-4 w-4 mr-2" />
                                                        Share
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleMoveToFolderClick(item.id, item.name, item.type)}>
                                                        <IconFolder className="h-4 w-4 mr-2" />
                                                        Move to folder
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleRenameClick(item.id, item.name, item.type)}>
                                                        <IconEdit className="h-4 w-4 mr-2" />
                                                        Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDetailsClick(item.id, item.name, item.type)}>
                                                        <IconInfoCircle className="h-4 w-4 mr-2" />
                                                        Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleMoveToTrashClick(item.id, item.name, item.type)} variant="destructive">
                                                        <IconTrash className="h-4 w-4 mr-2" />
                                                        Move to trash
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
                    <div className="p-4" onContextMenu={(e) => handleContextMenu(e)}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`group relative bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-all duration-200 cursor-pointer ${selectedItems.has(item.id) ? 'ring-2 ring-primary bg-muted' : ''
                                        }`}
                                    onClick={() => {
                                        if (item.type === 'folder') {
                                            handleFolderDoubleClick(item.id, item.name);
                                        } else if (item.type === 'file' && item.mimeType && canPreviewFile(item.mimeType)) {
                                            handlePreviewClick(item.id, item.name, item.mimeType);
                                        }
                                    }}
                                    onDoubleClick={() => {
                                        if (item.type === 'folder') {
                                            handleFolderDoubleClick(item.id, item.name);
                                        } else if (item.type === 'file' && item.mimeType && canPreviewFile(item.mimeType)) {
                                            handlePreviewClick(item.id, item.name, item.mimeType);
                                        }
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                >
                                    {/* Selection checkbox */}
                                    <div className="absolute top-2 left-2 z-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(item.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                const newSelected = new Set(selectedItems);
                                                if (e.target.checked) {
                                                    newSelected.add(item.id);
                                                } else {
                                                    newSelected.delete(item.id);
                                                }
                                                setSelectedItems(newSelected);
                                            }}
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                    </div>

                                    {/* File/Folder icon */}
                                    <div className="flex flex-col items-center gap-3 pt-6">
                                        <div className="text-4xl">
                                            {getFileIcon(item.mimeType || '', item.type)}
                                        </div>

                                        {/* File name */}
                                        {isTextTruncated(item.name) ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p className="text-sm font-medium text-center text-foreground line-clamp-2 break-words w-full cursor-default">
                                                        {truncateFilename(item.name)}
                                                    </p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{item.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <p className="text-sm font-medium text-center text-foreground line-clamp-2 break-words w-full cursor-default">
                                                {truncateFilename(item.name)}
                                            </p>
                                        )}

                                        {/* File size or folder indicator */}
                                        <p className="text-xs text-muted-foreground text-center">
                                            {item.type === 'folder' ? 'Folder' : formatFileSize(item.size || 0)}
                                        </p>

                                        {/* Modified date */}
                                        <p className="text-xs text-muted-foreground text-center font-[var(--font-jetbrains-mono)] font-semibold tracking-wider">
                                            {formatDate(item.createdAt)}
                                        </p>
                                    </div>

                                    {/* Actions menu */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm">
                                                    <DotsVertical className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => handleDownloadClick(item.id, item.name, item.type)}>
                                                    <IconDownload className="h-4 w-4 mr-2" />
                                                    Download
                                                </DropdownMenuItem>
                                                {item.type === 'file' && item.mimeType && canPreviewFile(item.mimeType) && (
                                                    <DropdownMenuItem onClick={() => handlePreviewClick(item.id, item.name, item.mimeType)}>
                                                        <IconEye className="h-4 w-4 mr-2" />
                                                        Preview
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => handleShareClick(item.id, item.name, item.type)}>
                                                    <IconShare3 className="h-4 w-4 mr-2" />
                                                    Share
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleMoveToFolderClick(item.id, item.name, item.type)}>
                                                    <IconFolder className="h-4 w-4 mr-2" />
                                                    Move to folder
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleRenameClick(item.id, item.name, item.type)}>
                                                    <IconEdit className="h-4 w-4 mr-2" />
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDetailsClick(item.id, item.name, item.type)}>
                                                    <IconInfoCircle className="h-4 w-4 mr-2" />
                                                    Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleMoveToTrashClick(item.id, item.name, item.type)} variant="destructive">
                                                    <IconTrash className="h-4 w-4 mr-2" />
                                                    Move to trash
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredItems.length === 0 && (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <IconFile className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">No files found</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </TableCard.Root>

            <RenameModal
                itemName={selectedItemForRename?.name || ""}
                initialName={renameModalInitialName}
                itemType={selectedItemForRename?.type || "file"}
                open={renameModalOpen}
                onOpenChange={(open) => {
                    setRenameModalOpen(open);
                    if (!open) setRenameModalInitialName(undefined);
                }}
                onRename={handleRename}
            />

            {/* Conflict modal for rename actions */}
            <ConflictModal
                isOpen={renameConflictOpen}
                onClose={() => setRenameConflictOpen(false)}
                conflicts={renameConflictItems}
                onResolve={handleRenameConflictResolution}
                operation="rename"
            />

            <ShareModal
                itemId={selectedItemForShare?.id || ""}
                itemName={selectedItemForShare?.name || ""}
                itemType={selectedItemForShare?.type || "file"}
                open={shareModalOpen}
                onOpenChange={setShareModalOpen}
                onShareUpdate={refreshFiles}
            />

            <SharePickerModal
                open={sharePickerModalOpen}
                onOpenChange={setSharePickerModalOpen}
                onFileSelected={(fileId, fileName, fileType) => {
                    setSelectedItemForShare({ id: fileId, name: fileName, type: fileType });
                    setShareModalOpen(true);
                    setSharePickerModalOpen(false);
                }}
            />

            <DetailsModal
                itemId={selectedItemForDetails?.id || ""}
                itemName={selectedItemForDetails?.name || ""}
                itemType={selectedItemForDetails?.type || "file"}
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
            />

            <MoveToFolderModal
                items={selectedItemsForMoveToFolder}
                open={moveToFolderModalOpen}
                onOpenChange={setMoveToFolderModalOpen}
                onItemMoved={() => {
                    setSelectedItems(new Set()); // Clear selection after moving items
                    refreshFiles();
                }}
            />

            <MoveToTrashModal
                itemId={selectedItemForMoveToTrash?.id || ""}
                itemName={selectedItemForMoveToTrash?.name || ""}
                itemType={selectedItemForMoveToTrash?.type || "file"}
                open={moveToTrashModalOpen}
                onOpenChange={setMoveToTrashModalOpen}
                onItemMoved={() => {
                    // Remove the item from the current view immediately (optimistic update)
                    setFiles(prevFiles => prevFiles.filter(file => file.id !== selectedItemForMoveToTrash?.id));

                    // Clear selection for the moved item
                    if (selectedItemForMoveToTrash?.id) {
                        setSelectedItems(prevSelected => {
                            const newSelected = new Set(prevSelected);
                            newSelected.delete(selectedItemForMoveToTrash.id);
                            return newSelected;
                        });
                    }
                    // No need to refreshFiles() since we do optimistic updates
                }}
            />

            {/* Context Menu */}
            {contextMenu?.isOpen && (
                <div
                    className="fixed inset-0 z-50"
                    onClick={handleContextMenuClose}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        handleContextMenuClose();
                    }}
                >
                    <div
                        className="absolute bg-popover border border-border rounded-md shadow-lg py-1 min-w-48 z-50 animate-in fade-in-0 zoom-in-95 duration-200 ease-out pointer-events-auto"
                        style={{
                            left: (() => {
                                const menuWidth = 192; // min-w-48 = 192px
                                const viewportWidth = window.innerWidth;
                                const cursorX = contextMenu.x;

                                // If menu would go off-screen to the right, position it to the left of cursor
                                if (cursorX + menuWidth > viewportWidth) {
                                    return cursorX - menuWidth;
                                }
                                return cursorX;
                            })(),
                            top: (() => {
                                const menuHeight = 200; // Approximate height
                                const viewportHeight = window.innerHeight;
                                const cursorY = contextMenu.y;

                                // If menu would go off-screen to the bottom, position it above cursor
                                if (cursorY + menuHeight > viewportHeight) {
                                    return cursorY - menuHeight;
                                }
                                return cursorY;
                            })(),
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {!contextMenu.targetItem ? (
                            // Context menu for empty space
                            <>
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('createFolder')}
                                >
                                    <IconFolderPlus className="h-4 w-4" />
                                    Create Folder
                                </button>
                                <div className="h-px bg-border mx-2 my-1" />
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('importFile')}
                                >
                                    <IconFileUpload className="h-4 w-4" />
                                    Import File
                                </button>
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('importFolder')}
                                >
                                    <IconFolderDown className="h-4 w-4" />
                                    Import Folder
                                </button>
                                <div className="h-px bg-border mx-2 my-1" />
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('share')}
                                >
                                    <IconShare3 className="h-4 w-4" />
                                    Share
                                </button>
                            </>
                        ) : (
                            // Context menu for items
                            <>
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('download', contextMenu.targetItem)}
                                >
                                    <IconDownload className="h-4 w-4" />
                                    Download
                                </button>
                                {contextMenu.targetItem?.type === 'file' && contextMenu.targetItem?.mimeType && canPreviewFile(contextMenu.targetItem.mimeType) && (
                                    <button
                                        className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                        onClick={() => {
                                            if (contextMenu.targetItem) {
                                                handlePreviewClick(contextMenu.targetItem.id, contextMenu.targetItem.name, contextMenu.targetItem.mimeType);
                                            }
                                            handleContextMenuClose();
                                        }}
                                    >
                                        <IconEye className="h-4 w-4" />
                                        Preview
                                    </button>
                                )}
                                {/* TODO: Only show Copy Link if item is shared */}
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('copyLink', contextMenu.targetItem)}
                                >
                                    <IconLink className="h-4 w-4" />
                                    Copy Link
                                </button>
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('share', contextMenu.targetItem)}
                                >
                                    <IconShare3 className="h-4 w-4" />
                                    Share
                                </button>
                                <div className="h-px bg-border mx-2 my-1" />
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('moveToFolder', contextMenu.targetItem)}
                                >
                                    <IconFolder className="h-4 w-4" />
                                    Move to Folder
                                </button>
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('rename', contextMenu.targetItem)}
                                >
                                    <IconEdit className="h-4 w-4" />
                                    Rename
                                </button>
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm"
                                    onClick={() => handleContextMenuAction('details', contextMenu.targetItem)}
                                >
                                    <IconInfoCircle className="h-4 w-4" />
                                    Details
                                </button>
                                <div className="h-px bg-border mx-2 my-1" />
                                <button
                                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => handleContextMenuAction('moveToTrash', contextMenu.targetItem)}
                                >
                                    <IconTrash className="h-4 w-4" />
                                    Move to Trash
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <PreviewModal
                file={selectedItemForPreview ? {
                    id: selectedItemForPreview.id,
                    name: selectedItemForPreview.name,
                    type: 'file',
                    mimeType: selectedItemForPreview.mimeType
                } : null}
                open={previewModalOpen}
                onOpenChange={setPreviewModalOpen}
                onDownload={handleDownloadClick}
            />
        </>
    );
};
