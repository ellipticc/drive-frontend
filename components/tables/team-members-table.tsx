"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DotsVertical } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import type { Selection } from "react-aria-components";
import { Table, TableCard, TableRowActionsDropdown } from "@/components/application/table/table";
import { Button } from "@/components/ui/button";
import { IconFolderPlus, IconUpload, IconFileUpload, IconShare3, IconListDetails, IconDownload, IconFolder, IconEdit, IconInfoCircle, IconTrash, IconPhoto, IconVideo, IconMusic, IconFileText, IconArchive, IconFile, IconHome, IconChevronRight, IconLoader2, IconLink } from "@tabler/icons-react";
import { CreateFolderModal } from "@/components/modals/create-folder-modal";
import { MoveToFolderModal } from "@/components/modals/move-to-folder-modal";
import { ShareModal } from "@/components/modals/share-modal";
import { SharePickerModal } from "@/components/modals/share-picker-modal";
import { DetailsModal } from "@/components/modals/details-modal";
import { MoveToTrashModal } from "@/components/modals/move-to-trash-modal";
import { RenameModal } from "@/components/modals/rename-modal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadFileToBrowser, downloadFolderAsZip, downloadMultipleItemsAsZip, DownloadProgress } from '@/lib/download';
import { apiClient, FileItem } from "@/lib/api";
import { toast } from "sonner";
import { uploadEncryptedFile } from "@/lib/upload";
import { keyManager } from "@/lib/key-manager";
import { UnifiedProgressModal, FileUploadState } from "@/components/modals/unified-progress-modal";
import { UploadManager, UploadTask } from "@/components/upload-manager";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const Table01DividerLineSm = ({ 
  searchQuery,
  onFileUpload,
  onFolderUpload
}: { 
  searchQuery?: string
  onFileUpload?: () => void
  onFolderUpload?: () => void
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "modified",
        direction: "descending",
    });

    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Folder navigation state
    const [currentFolderId, setCurrentFolderId] = useState<string>('root');
    const [folderPath, setFolderPath] = useState<Array<{id: string, name: string}>>([{id: 'root', name: 'My Files'}]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // View mode state
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Load view mode from localStorage on mount
    useEffect(() => {
        const savedViewMode = localStorage.getItem('viewMode') as 'table' | 'grid';
        if (savedViewMode && (savedViewMode === 'table' || savedViewMode === 'grid')) {
            setViewMode(savedViewMode);
        }
    }, []);

    // Save view mode to localStorage when it changes
    const handleViewModeChange = (newViewMode: 'table' | 'grid') => {
        setViewMode(newViewMode);
        localStorage.setItem('viewMode', newViewMode);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [selectedItemForRename, setSelectedItemForRename] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [selectedItemForShare, setSelectedItemForShare] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [sharePickerModalOpen, setSharePickerModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
    const [moveToFolderModalOpen, setMoveToFolderModalOpen] = useState(false);
    const [selectedItemsForMoveToFolder, setSelectedItemsForMoveToFolder] = useState<Array<{ id: string; name: string; type: "file" | "folder" }>>([]);
    const [moveToTrashModalOpen, setMoveToTrashModalOpen] = useState(false);
    const [selectedItemForMoveToTrash, setSelectedItemForMoveToTrash] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);

    // Folder upload state
    const [selectedFolderFiles, setSelectedFolderFiles] = useState<FileList | null>(null);

    // Upload state management
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadManagers, setUploadManagers] = useState<UploadManager[]>([]);

    // Download state management
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [currentDownloadFile, setCurrentDownloadFile] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);

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
    const buildUrlPath = (folderPath: Array<{id: string, name: string}>): string => {
        if (folderPath.length <= 1) return '/';
        return '/' + folderPath.slice(1).map(f => f.id).join('/');
    };

    // Update URL when folder navigation changes
    const updateUrl = (newFolderPath: Array<{id: string, name: string}>) => {
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
            setFolderPath([{id: 'root', name: 'My Files'}]);
            setIsInitialLoad(false);
            // Load files for root folder
            refreshFiles('root');
            return;
        }

        // Build folder path from URL segments
        const buildFolderPathFromUrl = async () => {
            try {
                let currentPath = [{id: 'root', name: 'My Files'}];
                let currentId = 'root';

                for (const segment of urlSegments) {
                    if (segment === 'root') continue;

                    // console.log(`Getting info for folder: ${segment}`);
                    // Get folder info to get the name
                    const response = await apiClient.getFolderInfo(segment);
                    // console.log(`Folder info response for ${segment}:`, response);

                    if (response.success && response.data) {
                        // console.log(`Folder ${segment} found: ${response.data.name}`);
                        currentPath.push({id: segment, name: response.data.name});
                        currentId = segment;
                    } else {
                        // Invalid folder ID, redirect to root
                        // console.warn(`Invalid folder ID in URL: ${segment}, response:`, response);
                        router.replace('/', { scroll: false });
                        setCurrentFolderId('root');
                        setFolderPath([{id: 'root', name: 'My Files'}]);
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
            } catch (error) {
                // console.error('Error parsing URL path:', error);
                // On error, redirect to root
                router.replace('/', { scroll: false });
                setCurrentFolderId('root');
                setFolderPath([{id: 'root', name: 'My Files'}]);
                setIsInitialLoad(false);
                // Load files for root folder
                await refreshFiles('root');
            }
        };

        buildFolderPathFromUrl();
    }, [pathname, isInitialLoad, router]);

    // Start file uploads with progress tracking
    const startUploads = async (files: File[]) => {
        // Open the unified modal immediately
        setUploadModalOpen(true);

        // Create upload managers for each file
        const newManagers = files.map(file => {
            return new UploadManager({
                file,
                folderId: currentFolderId === 'root' ? null : currentFolderId,
                onProgress: (task) => {
                    setUploadManagers(prev => prev.map(m =>
                        m.getTask().id === task.id ? m : m
                    ));
                    setUploadManagers(prev => [...prev]);
                },
                onComplete: (task) => {
                    console.log(`Upload completed for ${task.file.name}, fetching storage`);
                    refreshFiles();
                    // Fetch storage after each single file upload
                    apiClient.getUserStorage().then(storageResponse => {
                        if (storageResponse.success) {
                            console.log('Storage fetched after upload:', storageResponse.data);
                        } else {
                            console.error('Failed to fetch storage after upload:', storageResponse.error);
                        }
                    }).catch(error => {
                        console.error('Error fetching storage after upload:', error);
                    });
                },
                onError: (task) => {
                    // console.error(`Upload failed for ${task.file.name}:`, task.error);
                    toast.error(`Failed to upload ${task.file.name}`);
                },
                onCancel: (task) => {
                    // console.log(`Upload cancelled for ${task.file.name}`);
                    toast.info('Upload cancelled');
                }
            });
        });

        // Add all managers to state
        setUploadManagers(prev => [...prev, ...newManagers]);

        // Start all uploads
        newManagers.forEach(manager => manager.start());
    };

    // Start folder uploads with progress tracking (similar to file uploads but with folder hierarchy)
    const startFolderUploads = async (files: FileList) => {
        try {
            // Build file tree from FileList
            const buildFileTree = (files: FileList): any[] => {
                const root: { [key: string]: any } = {}

                Array.from(files).forEach(file => {
                    const pathParts = file.webkitRelativePath.split('/').filter(p => p)
                    let current = root

                    pathParts.forEach((part, index) => {
                        if (!current[part]) {
                            current[part] = {
                                name: part,
                                type: index === pathParts.length - 1 ? 'file' : 'folder',
                                path: pathParts.slice(0, index + 1).join('/'),
                                ...(index === pathParts.length - 1 ? { size: file.size, file } : { children: [] })
                            }
                        }

                        if (index < pathParts.length - 1) {
                            if (!current[part].children) {
                                current[part].children = []
                            }
                            current = current[part].children as { [key: string]: any }
                        }
                    })
                })

                // Convert to array and sort (folders first, then files alphabetically)
                const convertToArray = (node: { [key: string]: any }): any[] => {
                    return Object.values(node)
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
                            return a.name.localeCompare(b.name)
                        })
                        .map(item => ({
                            ...item,
                            ...(item.children ? { children: convertToArray(item.children) } : {})
                        }))
                }

                return convertToArray(root)
            }

            // Flatten tree into upload tasks (folders first, then files)
            const flattenTree = (nodes: any[], parentPath = ''): any[] => {
                const tasks: any[] = []

                nodes.forEach(node => {
                    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name

                    if (node.type === 'folder') {
                        tasks.push({
                            id: `folder-${fullPath}`,
                            node: { ...node, path: fullPath },
                            status: 'pending',
                            progress: 0
                        })

                        if (node.children) {
                            tasks.push(...flattenTree(node.children, fullPath))
                        }
                    } else {
                        tasks.push({
                            id: `file-${fullPath}`,
                            node: { ...node, path: fullPath },
                            status: 'pending',
                            progress: 0
                        })
                    }
                })

                return tasks
            }

            // Create folder with manifest signatures
            const createFolderWithManifest = async (name: string, parentId: string | null): Promise<string> => {
                const userKeys = await keyManager.getUserKeys()

                // Generate manifest signatures for the folder
                const manifestData = {
                    name,
                    created: Math.floor(Date.now() / 1000),
                    version: '2.0-folder',
                    algorithmVersion: 'v3-hybrid-pqc'
                }

                const manifestJson = JSON.stringify(manifestData)
                const manifestBytes = new TextEncoder().encode(manifestJson)

                // Sign with Ed25519
                const { sign: ed25519Sign } = await import('@noble/ed25519')
                const ed25519Signature = await ed25519Sign(manifestBytes, userKeys.keypairs.ed25519PrivateKey)
                const manifestSignatureEd25519 = btoa(String.fromCharCode(...ed25519Signature))

                // Sign with Dilithium
                const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js')
                const dilithiumSignature = ml_dsa65.sign(userKeys.keypairs.dilithiumPrivateKey, manifestBytes)
                const manifestSignatureDilithium = btoa(String.fromCharCode(...new Uint8Array(dilithiumSignature)))

                const response = await apiClient.createFolder({
                    name,
                    parentId,
                    manifestJson,
                    manifestSignatureEd25519,
                    manifestPublicKeyEd25519: userKeys.keypairs.ed25519PublicKey,
                    manifestSignatureDilithium,
                    manifestPublicKeyDilithium: userKeys.keypairs.dilithiumPublicKey,
                    algorithmVersion: 'v3-hybrid-pqc'
                })

                if (!response.success || !response.data) {
                    throw new Error('Failed to create folder')
                }

                return response.data.id
            }

            // Create folder recursively
            const createFolderRecursive = async (pathParts: string[], currentParentId: string | null = null): Promise<string | null> => {
                if (pathParts.length === 0) return currentParentId

                const folderName = pathParts[0]
                const remainingParts = pathParts.slice(1)

                try {
                    // Check if folder already exists
                    const response = await apiClient.getFolders({ parentId: currentParentId || undefined })
                    const existingFolder = response.data?.find((folder: any) => folder.name === folderName)

                    let folderId: string
                    if (existingFolder) {
                        folderId = existingFolder.id
                    } else {
                        // Create new folder
                        folderId = await createFolderWithManifest(folderName, currentParentId)
                    }

                    // Continue with remaining path parts
                    return createFolderRecursive(remainingParts, folderId)
                } catch (error) {
                    // console.error(`Error creating folder ${folderName}:`, error)
                    throw error
                }
            }

            const tree = buildFileTree(files)
            const tasks = flattenTree(tree)

            // Open the unified modal immediately
            setUploadModalOpen(true)

            // Process tasks in order (folders first, then files)
            const fileUploadManagers: UploadManager[] = []

            for (const task of tasks) {
                if (task.node.type === 'folder') {
                    try {
                        const pathParts = task.node.path.split('/').filter((p: string) => p)
                        const folderId = await createFolderRecursive(pathParts, currentFolderId === 'root' ? null : currentFolderId)

                        // Store the root folder ID for file uploads
                        // (This is now handled by createFolderRecursive using currentFolderId as base)

                    } catch (error) {
                        // console.error(`Error creating folder ${task.node.name}:`, error)
                        toast.error(`Failed to create folder "${task.node.name}"`)
                    }
                } else {
                    // Upload file using UploadManager for progress tracking
                    try {
                        const pathParts = task.node.path.split('/').filter((p: string) => p)
                        const fileName = pathParts.pop()!
                        const folderPath = pathParts

                        let parentFolderId = currentFolderId === 'root' ? null : currentFolderId
                        if (folderPath.length > 0) {
                            parentFolderId = await createFolderRecursive(folderPath, currentFolderId === 'root' ? null : currentFolderId)
                        }

                        // Create UploadManager for this file
                        const uploadManager = new UploadManager({
                            file: task.node.file,
                            folderId: parentFolderId,
                            onProgress: (task) => {
                                setUploadManagers(prev => prev.map(m =>
                                    m.getTask().id === task.id ? m : m
                                ));
                                setUploadManagers(prev => [...prev]);
                            },
                            onComplete: (task) => {
                                // console.log(`Upload completed for ${task.file.name}`);
                                // Remove refreshFiles() call - we'll refresh once after all uploads complete
                            },
                            onError: (task) => {
                                // console.error(`Upload failed for ${task.file.name}:`, task.error);
                                toast.error(`Failed to upload ${task.file.name}`);
                            },
                            onCancel: (task) => {
                                // console.log(`Upload cancelled for ${task.file.name}`);
                                toast.info('Upload cancelled');
                            }
                        });

                        // Add to upload managers
                        setUploadManagers(prev => [...prev, uploadManager]);
                        fileUploadManagers.push(uploadManager);

                        // Start the upload
                        uploadManager.start();

                    } catch (error) {
                        // console.error(`Error uploading file ${task.node.name}:`, error)
                        toast.error(`Failed to upload file "${task.node.name}"`)
                    }
                }
            }

            // Wait for all file uploads to complete before refreshing
            if (fileUploadManagers.length > 0) {
                const uploadPromises = fileUploadManagers.map(manager => {
                    return new Promise<void>((resolve) => {
                        const checkStatus = () => {
                            const task = manager.getTask();
                            if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
                                resolve();
                            } else {
                                // Check again in 100ms
                                setTimeout(checkStatus, 100);
                            }
                        };
                        checkStatus();
                    });
                });

                // Wait for all uploads to complete
                await Promise.all(uploadPromises);
            }

            // Refresh files after all uploads complete
            refreshFiles()

        } catch (error) {
            // console.error('Failed to start folder uploads:', error)
            toast.error('Failed to start folder uploads')
        }
    };

    // Handle upload cancellation
    const handleCancelUpload = (uploadId: string) => {
        const manager = uploadManagers.find(m => m.getTask().id === uploadId);
        if (manager) {
            manager.cancel();
        }
    };

    // Handle upload pause
    const handlePauseUpload = (uploadId: string) => {
        const manager = uploadManagers.find(m => m.getTask().id === uploadId);
        if (manager) {
            manager.pause();
        }
    };

    // Handle upload resume
    const handleResumeUpload = (uploadId: string) => {
        const manager = uploadManagers.find(m => m.getTask().id === uploadId);
        if (manager) {
            manager.resume();
        }
    };

    // Handle upload retry
    const handleRetryUpload = async (uploadId: string) => {
        const manager = uploadManagers.find(m => m.getTask().id === uploadId);
        if (manager && manager.getTask().status === 'failed') {
            // Create a new manager for retry
            const newManager = new UploadManager({
                file: manager.getTask().file,
                folderId: currentFolderId === 'root' ? null : currentFolderId,
                onProgress: (task) => {
                    setUploadManagers(prev => prev.map(m =>
                        m.getTask().id === task.id ? m : m
                    ));
                    setUploadManagers(prev => [...prev]);
                },
                onComplete: (task) => {
                    console.log(`Retry upload completed for ${task.file.name}, fetching storage`);
                    refreshFiles();
                    // Fetch storage after retry upload
                    apiClient.getUserStorage().then(storageResponse => {
                        if (storageResponse.success) {
                            console.log('Storage fetched after retry upload:', storageResponse.data);
                        } else {
                            console.error('Failed to fetch storage after retry upload:', storageResponse.error);
                        }
                    }).catch(error => {
                        console.error('Error fetching storage after retry upload:', error);
                    });
                },
                onError: (task) => {
                    // console.error(`Upload failed for ${task.file.name}:`, task.error);
                    toast.error(`Failed to upload ${task.file.name}`);
                },
                onCancel: (task) => {
                    // console.log(`Upload cancelled for ${task.file.name}`);
                    toast.info('Upload cancelled');
                }
            });

            // Remove old manager and add new one
            setUploadManagers(prev => prev.filter(m => m.getTask().id !== uploadId).concat(newManager));
            newManager.start();
        }
    };

    // Handle cancel all uploads
    const handleCancelAllUploads = () => {
        uploadManagers.forEach(manager => {
            if (manager.getTask().status === 'uploading' || manager.getTask().status === 'pending' || manager.getTask().status === 'paused') {
                manager.cancel();
            }
        });
        toast.info('All uploads cancelled');
    };

    // Load files on component mount (only if not initial URL-based load)
    useEffect(() => {
        if (!isInitialLoad) {
            refreshFiles();
        }
    }, []);

    // Refresh files and folders after folder creation
    const refreshFiles = async (folderId: string = currentFolderId) => {
        try {
            setIsLoading(true);
            setError(null);
            // console.log(`Loading folder contents for: ${folderId}`);
            const response = await apiClient.getFolderContents(folderId);
            // console.log(`Folder contents response:`, response);
            if (response.success && response.data) {
                // Combine folders and files into a single array
                const combinedItems: FileItem[] = [
                    ...(response.data.folders || []).map((folder: any) => ({
                        id: folder.id,
                        name: folder.name,
                        parentId: folder.parentId,
                        path: folder.path,
                        type: 'folder' as const,
                        createdAt: folder.createdAt,
                        updatedAt: folder.updatedAt,
                        is_shared: folder.is_shared || false
                    })),
                    ...(response.data.files || []).map((file: any) => ({
                        id: file.id,
                        name: file.name,
                        filename: file.filename,
                        size: file.size,
                        mimeType: file.mimeType,
                        folderId: file.folderId,
                        type: 'file' as const,
                        createdAt: file.createdAt,
                        updatedAt: file.updatedAt,
                        sha256Hash: file.sha256Hash,
                        is_shared: file.is_shared || false
                    }))
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
                        setFolderPath([{id: 'root', name: 'My Files'}]);
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
                    setFolderPath([{id: 'root', name: 'My Files'}]);
                }, 2000);
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Navigate to a folder
    const navigateToFolder = async (folderId: string, folderName: string) => {
        const newPath = [...folderPath, { id: folderId, name: folderName }];
        setCurrentFolderId(folderId);
        setFolderPath(newPath);
        updateUrl(newPath);
        await refreshFiles(folderId);
    };

    // Navigate to parent folder
    const navigateToParent = async () => {
        if (folderPath.length > 1) {
            const newPath = folderPath.slice(0, -1);
            const parentFolder = newPath[newPath.length - 1];
            setCurrentFolderId(parentFolder.id);
            setFolderPath(newPath);
            updateUrl(newPath);
            await refreshFiles(parentFolder.id);
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
            await refreshFiles(folderId);
        }
    };

    const handleFileUpload = () => {
        if (onFileUpload) {
            onFileUpload()
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleFolderUpload = () => {
        if (onFolderUpload) {
            onFolderUpload()
        } else {
            folderInputRef.current?.click();
        }
    };

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

    const handleRenameClick = (itemId: string, itemName: string, itemType: "file" | "folder") => {
        setSelectedItemForRename({ id: itemId, name: itemName, type: itemType });
        setRenameModalOpen(true);
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
                // Here you would open a details modal with the information
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
                            } catch (error) {
                                // console.error('Restore error:', error);
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
            // console.error('Move to trash error:', error);
            toast.error(`Failed to move ${itemType} to trash`);
        }
    };

    // Bulk move to trash handler
    const handleBulkMoveToTrash = async () => {
        const selectedItemsArray = Array.from(selectedItems).map(id => {
            const item = files.find(f => f.id === id);
            return item ? { id: item.id, name: item.name, type: item.type } : null;
        }).filter(Boolean) as Array<{id: string, name: string, type: "file" | "folder"}>;

        if (selectedItemsArray.length === 0) return;

        try {
            // Separate files and folders
            const fileIds = selectedItemsArray.filter(item => item.type === 'file').map(item => item.id);
            const folderIds = selectedItemsArray.filter(item => item.type === 'folder').map(item => item.id);

            let successCount = 0;
            let errorCount = 0;

            // Move files to trash using bulk API
            if (fileIds.length > 0) {
                const fileResponse = await apiClient.bulkMoveToTrash(fileIds);
                if (fileResponse.success) {
                    successCount += fileResponse.data?.movedCount || 0;
                } else {
                    errorCount += fileIds.length;
                }
            }

            // Move folders to trash individually (no bulk API for folders yet)
            for (const folderId of folderIds) {
                try {
                    const folderResponse = await apiClient.moveFolderToTrash(folderId);
                    if (folderResponse.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }

            // Remove successfully moved items from the current view
            setFiles(prevFiles => prevFiles.filter(file => 
                !selectedItemsArray.some(selected => 
                    selected.id === file.id && (
                        (selected.type === 'file' && fileIds.includes(selected.id)) ||
                        (selected.type === 'folder' && folderIds.includes(selected.id))
                    )
                )
            ));

            // Clear selection for all items
            setSelectedItems(new Set());

            // Show appropriate toast messages
            if (successCount > 0) {
                if (errorCount === 0) {
                    toast(`${successCount} item${successCount > 1 ? 's' : ''} moved to trash`, {
                        action: {
                            label: "Cancel",
                            onClick: async () => {
                                // Restore all successfully moved items
                                const successfulFileIds = fileIds.slice(0, successCount - folderIds.length);
                                const successfulFolderIds = folderIds.slice(0, Math.min(folderIds.length, successCount - successfulFileIds.length));

                                if (successfulFileIds.length > 0) {
                                    await apiClient.restoreFilesFromTrash(successfulFileIds);
                                }
                                for (const folderId of successfulFolderIds) {
                                    await apiClient.restoreFolderFromTrash(folderId);
                                }
                                refreshFiles();
                            },
                        },
                    });
                } else {
                    toast(`${successCount} item${successCount > 1 ? 's' : ''} moved to trash, ${errorCount} failed`);
                }
            } else {
                toast.error(`Failed to move any items to trash`);
            }

            refreshFiles(); // Refresh to show current state
        } catch (error) {
            // console.error('Bulk move to trash error:', error);
            toast.error(`Failed to move items to trash`);
        }
    };

    // Handle file download (single item or folder)
    const handleDownloadClick = async (itemId: string, itemName: string, itemType: "file" | "folder") => {
        if (itemType === 'folder') {
            // Download folder as ZIP
            try {
                setDownloadError(null);
                setCurrentDownloadFile({ id: itemId, name: itemName, type: itemType });

                // Open the unified modal immediately when download starts
                setUploadModalOpen(true);

                // Get user keys
                const userKeys = await keyManager.getUserKeys();

                // Start folder ZIP download with progress tracking
                await downloadFolderAsZip(itemId, itemName, userKeys, (progress: DownloadProgress) => {
                    setDownloadProgress(progress);
                });

                toast.success('Folder downloaded successfully as ZIP');

            } catch (error) {
                // console.error('Folder download error:', error);
                setDownloadError(error instanceof Error ? error.message : 'Folder download failed');
                toast.error('Folder download failed');
            }
        } else {
            // Download single file
            try {
                setDownloadError(null);
                setCurrentDownloadFile({ id: itemId, name: itemName, type: itemType });

                // Open the unified modal immediately when download starts
                setUploadModalOpen(true);

                // Get user keys
                const userKeys = await keyManager.getUserKeys();

                // Start download with progress tracking
                await downloadFileToBrowser(itemId, userKeys, (progress) => {
                    setDownloadProgress(progress);
                });

                toast.success('Download completed successfully');

            } catch (error) {
                // console.error('Download error:', error);
                setDownloadError(error instanceof Error ? error.message : 'Download failed');
                toast.error('Download failed');
            }
        }
    };

    // Handle bulk download of selected items
    const handleBulkDownload = async () => {
        const selectedItemsArray = Array.from(selectedItems).map(id => {
            const item = files.find(f => f.id === id);
            return item ? { id: item.id, name: item.name, type: item.type } : null;
        }).filter(Boolean) as Array<{id: string, name: string, type: "file" | "folder"}>;

        if (selectedItemsArray.length === 0) return;

        // If only one item is selected, download it directly (no ZIP for single files)
        if (selectedItemsArray.length === 1) {
            const item = selectedItemsArray[0];
            await handleDownloadClick(item.id, item.name, item.type);
            return;
        }

        // Multiple items selected - create ZIP
        try {
            setDownloadError(null);
            setCurrentDownloadFile({ id: 'bulk', name: 'Multiple Items', type: 'file' });

            // Open the unified modal immediately
            setUploadModalOpen(true);

            // Get user keys
            const userKeys = await keyManager.getUserKeys();

            // Start bulk download with progress tracking
            await downloadMultipleItemsAsZip(selectedItemsArray, userKeys, (progress) => {
                setDownloadProgress(progress);
            });

            toast.success(`Downloaded ${selectedItemsArray.length} items successfully`);

        } catch (error) {
            // console.error('Bulk download error:', error);
            setDownloadError(error instanceof Error ? error.message : 'Bulk download failed');
            toast.error('Bulk download failed');
        }
    };
    const renderHeaderIcons = () => {
        const hasSelection = selectedItems.size > 0;
        const selectedCount = selectedItems.size;
        const hasMultipleSelection = selectedCount > 1;

        if (!hasSelection) {
            // Default state - no selection
            return (
                <>
                    <CreateFolderModal 
                        parentId={currentFolderId === 'root' ? null : currentFolderId}
                        onFolderCreated={refreshFiles}
                    >
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
                        <IconUpload className="h-4 w-4" />
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
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={hasMultipleSelection}
                        onClick={() => {
                            if (!hasMultipleSelection) {
                                const firstItem = Array.from(selectedItems).map(id => files.find(f => f.id === id)).filter(Boolean)[0];
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
                                const item = files.find(f => f.id === id);
                                return item ? { id: item.id, name: item.name, type: item.type } : null;
                            }).filter(Boolean) as Array<{id: string, name: string, type: "file" | "folder"}>;

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
                                const firstItem = Array.from(selectedItems).map(id => files.find(f => f.id === id)).filter(Boolean)[0];
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
                                const firstItem = Array.from(selectedItems).map(id => files.find(f => f.id === id)).filter(Boolean)[0];
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
                </>
            );
        }
    };

    // Handle download progress close
    const handleDownloadProgressClose = () => {
        setDownloadProgress(null);
        setDownloadError(null);
        setCurrentDownloadFile(null);

        // Close modal if there are no active uploads
        const hasActiveUploads = uploadManagers.some(m =>
            ['uploading', 'pending', 'paused'].includes(m.getTask().status)
        );
        if (!hasActiveUploads) {
            setUploadModalOpen(false);
        }
    };

    // Handle folder double-click navigation
    const handleFolderDoubleClick = async (folderId: string, folderName: string) => {
        await navigateToFolder(folderId, folderName);
    };

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, item?: FileItem) => {
        e.preventDefault();
        e.stopPropagation();

        // Close any existing context menu first
        setContextMenu(null);

        // Small delay to ensure the close happens before opening new one
        setTimeout(() => {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                isOpen: true,
                targetItem: item
            });
        }, 10);
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

    const handleRename = async (newName: string) => {
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
                refreshFiles(); // Refresh the file list
            } else {
                toast.error(`Failed to rename ${selectedItemForRename.type}`);
            }
        } catch (error) {
            // console.error('Rename error:', error);
            toast.error(`Failed to rename ${selectedItemForRename.type}`);
        }

        setRenameModalOpen(false);
        setSelectedItemForRename(null);
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
        return files.sort((a, b) => {
            const first = a[sortDescriptor.column as keyof FileItem];
            const second = b[sortDescriptor.column as keyof FileItem];

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
                const firstHash = a.sha256Hash || '';
                const secondHash = b.sha256Hash || '';
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
                                    className={`hover:text-primary transition-colors ${
                                        index === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                                    }`}
                                    disabled={index === folderPath.length - 1}
                                >
                                    {folder.name}
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
                                    <IconUpload className="h-4 w-4" />
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
                                    className={`hover:text-primary transition-colors ${
                                        index === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                                    }`}
                                    disabled={index === folderPath.length - 1}
                                >
                                    {folder.name}
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
                                    <IconUpload className="h-4 w-4" />
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
                                className={`hover:text-primary transition-colors ${
                                    index === folderPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                                }`}
                                disabled={index === folderPath.length - 1}
                            >
                                {folder.name}
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
                        {renderHeaderIcons()}

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
                            {...({ webkitdirectory: "" } as any)}
                        />
                    </div>
                }
                className="py-1 [&>div>h2]:text-base [&>div>h2]:font-medium h-12 flex-shrink-0 border-0"
            />
            {viewMode === 'table' ? (
                <Table aria-label="Files" selectionMode="multiple" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor} selectedKeys={selectedItems} onSelectionChange={(keys) => {
                    if (keys === 'all') {
                        setSelectedItems(new Set(filteredItems.map(item => item.id)));
                    } else {
                        setSelectedItems(new Set(Array.from(keys as Set<string>)));
                    }
                }}
                onContextMenu={(e) => handleContextMenu(e)}
                >
                    <Table.Header>
                        <Table.Head id="name" label="Name" isRowHeader allowsSorting className="w-full max-w-1/4" align="left" />
                        <Table.Head id="modified" label="Modified" allowsSorting align="left" />
                        <Table.Head id="size" label="Size" allowsSorting align="right" />
                        <Table.Head id="checksum" label="Checksum" allowsSorting align="right" className="pr-2" />
                        <Table.Head id="shared" label="" align="center" className="w-8" />
                        <Table.Head id="actions" align="center" />
                    </Table.Header>

                    <Table.Body items={filteredItems}>
                        {(item) => (
                            <Table.Row 
                                id={item.id}
                                onDoubleClick={item.type === 'folder' ? () => handleFolderDoubleClick(item.id, item.name) : undefined}
                                className="group hover:bg-muted/50 transition-colors duration-150"
                                onContextMenu={(e) => handleContextMenu(e, item)}
                            >
                                <Table.Cell className="w-full max-w-1/4">
                                    <div className="flex items-center gap-2">
                                        <div className="text-base">
                                            {getFileIcon(item.mimeType || '', item.type)}
                                        </div>
                                        <p className="text-sm font-medium whitespace-nowrap text-foreground">
                                            {item.name}
                                        </p>
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="text-left">
                                    <span className="text-xs text-muted-foreground font-mono break-all">
                                        {formatDate(item.createdAt)}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-right">
                                    <span className="text-xs text-muted-foreground font-mono break-all">
                                        {item.type === 'folder' ? '--' : formatFileSize(item.size || 0)}
                                    </span>
                                </Table.Cell>
                                <Table.Cell className="text-right">
                                    {item.type === 'folder' ? (
                                        <span className="text-xs text-muted-foreground font-mono break-all">N/A</span>
                                    ) : item.sha256Hash ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono break-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(item.sha256Hash!);
                                                        setCopiedHashId(item.id);
                                                        setTimeout(() => setCopiedHashId(null), 300);
                                                    }}
                                                >
                                                    {item.sha256Hash.substring(0, 5)}...{item.sha256Hash.substring(item.sha256Hash.length - 5)}
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent 
                                                className="max-w-none whitespace-nowrap font-[var(--font-jetbrains-mono)] font-semibold tracking-wider"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(item.sha256Hash!);
                                                    setCopiedHashId(item.id);
                                                    setTimeout(() => setCopiedHashId(null), 500);
                                                }}
                                            >
                                                <p className={`text-xs cursor-pointer transition-all duration-300 ${copiedHashId === item.id ? 'animate-pulse bg-primary/20 text-primary scale-105' : ''}`}>{item.sha256Hash}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <span className="text-xs text-muted-foreground font-mono break-all">N/A</span>
                                    )}
                                </Table.Cell>
                                <Table.Cell className="px-1 w-8">
                                    {/* Shared icon */}
                                    {item.is_shared ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center justify-center">
                                                    <IconShare3 className="h-3.5 w-3.5 text-blue-500 opacity-70 hover:opacity-100 transition-opacity" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>This item is shared</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : null}
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
                                                <DropdownMenuItem onClick={() => handleDownloadClick(item.id, item.name, item.type)}>
                                                    <IconDownload className="h-4 w-4 mr-2" />
                                                    Download
                                                </DropdownMenuItem>
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
                                className={`group relative bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-all duration-200 cursor-pointer ${
                                    selectedItems.has(item.id) ? 'ring-2 ring-primary bg-muted' : ''
                                }`}
                                onClick={() => {
                                    if (item.type === 'folder') {
                                        handleFolderDoubleClick(item.id, item.name);
                                    }
                                }}
                                onDoubleClick={() => {
                                    if (item.type === 'folder') {
                                        handleFolderDoubleClick(item.id, item.name);
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
                                    <p className="text-sm font-medium text-center text-foreground line-clamp-2 break-words w-full">
                                        {item.name}
                                    </p>

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
            itemType={selectedItemForRename?.type || "file"}
            open={renameModalOpen}
            onOpenChange={setRenameModalOpen}
            onRename={handleRename}
        />

        <ShareModal
            itemId={selectedItemForShare?.id || ""}
            itemName={selectedItemForShare?.name || ""}
            itemType={selectedItemForShare?.type || "file"}
            open={shareModalOpen}
            onOpenChange={setShareModalOpen}
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
                // Clear selection for the moved item
                if (selectedItemForMoveToTrash?.id) {
                    setSelectedItems(prevSelected => {
                        const newSelected = new Set(prevSelected);
                        newSelected.delete(selectedItemForMoveToTrash.id);
                        return newSelected;
                    });
                }
                refreshFiles();
            }}
        />

        <UnifiedProgressModal
            open={uploadModalOpen}
            onOpenChange={setUploadModalOpen}
            uploads={uploadManagers.map(m => {
                const task = m.getTask();
                return {
                    id: task.id,
                    file: task.file,
                    status: task.status,
                    progress: task.progress,
                    error: task.error,
                    result: task.result
                };
            })}
            onCancelUpload={handleCancelUpload}
            onPauseUpload={handlePauseUpload}
            onResumeUpload={handleResumeUpload}
            onRetryUpload={handleRetryUpload}
            onCancelAllUploads={handleCancelAllUploads}
            downloadProgress={downloadProgress}
            downloadFilename={currentDownloadFile?.type === 'folder' ? `${currentDownloadFile.name}.zip` : currentDownloadFile?.name}
            downloadFileSize={currentDownloadFile?.type === 'file' ? (files.find(f => f.id === currentDownloadFile.id)?.size || 0) : 0}
            onCancelDownload={handleDownloadProgressClose}
            onRetryDownload={downloadError ? () => handleDownloadClick(currentDownloadFile!.id, currentDownloadFile!.name, currentDownloadFile!.type) : undefined}
            downloadError={downloadError}
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
                    className="absolute bg-popover border border-border rounded-md shadow-lg py-1 min-w-48 z-50"
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
                                <IconUpload className="h-4 w-4" />
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
        </>
    );
};
