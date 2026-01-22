"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { IconFolder, IconChevronRight, IconChevronDown, IconLoader2, IconCopy } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { decryptFilename, computeFilenameHmac, createSignedFileManifest, decryptUserPrivateKeys, createSignedFolderManifest } from "@/lib/crypto"
import { apiClient, PQCKeypairs, type FolderContentItem } from "@/lib/api"
import { truncateFilename } from "@/lib/utils"
import { masterKeyManager } from "@/lib/master-key"

interface CopyModalProps {
    children?: React.ReactNode
    itemId?: string
    itemName?: string
    itemType?: "file" | "folder"
    items?: Array<{ id: string; name: string; type: "file" | "folder" }> // For bulk operations
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onItemCopied?: () => void
    onConflict?: (conflicts: Array<{ id: string; name: string; type: "file" | "folder"; conflictingItemId?: string }>, destinationFolderId: string | null) => void
}

interface Folder {
    id: string
    name: string
    parentId: string | null
    path: string
    createdAt: string
    updatedAt: string
    isExpanded?: boolean
    isLoading?: boolean
    children?: Folder[]
    level?: number
    hasExploredChildren?: boolean
}

interface UserData {
    id: string
    // metadata fields returned by the profile endpoint
    created_at?: string
    storage_region?: string
    storage_endpoint?: string
    crypto_version?: string
    api_version?: string

    crypto_keypairs: {
        accountSalt: string
        pqcKeypairs: {
            kyber: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
            x25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
            dilithium: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
            ed25519: { publicKey: string; encryptedPrivateKey: string; privateKeyNonce: string; encryptionKey: string; encryptionNonce: string }
        }
    }
}

export function CopyModal({ children, itemId = "", itemName = "item", itemType = "file", items, open: externalOpen, onOpenChange: externalOnOpenChange, onItemCopied, onConflict }: CopyModalProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingFolders, setIsLoadingFolders] = useState(false)
    const [folders, setFolders] = useState<Folder[]>([])
    const [userData, setUserData] = useState<UserData | null>(null)
    const [userDataLoaded, setUserDataLoaded] = useState(false)

    // Use external state if provided, otherwise use internal state
    const open = externalOpen !== undefined ? externalOpen : internalOpen
    const setOpen = externalOnOpenChange || setInternalOpen

    // Determine if this is a bulk operation
    const isBulkOperation = items && items.length > 0
    const operationItems = isBulkOperation ? items : [{ id: itemId, name: itemName, type: itemType }]
    const operationTitle = isBulkOperation ? `Copy ${operationItems.length} item${operationItems.length > 1 ? 's' : ''} to Folder` : `Copy to Folder`
    const operationDescription = isBulkOperation
        ? `Choose a destination folder for ${operationItems.length} selected item${operationItems.length > 1 ? 's' : ''}.`
        : `Choose a destination folder for "${truncateFilename(itemName)}".`

    // Fetch folders and user data when modal opens
    useEffect(() => {
        if (open) {
            fetchFolders()
            fetchUserData()
        }
    }, [open])

    const fetchUserData = async () => {
        if (userDataLoaded) return;
        try {
            const response = await apiClient.getProfile()
            if (response.success && response.data?.user?.crypto_keypairs) {
                const cryptoKeys = response.data.user.crypto_keypairs as { accountSalt?: string; pqcKeypairs?: PQCKeypairs }
                if (cryptoKeys.pqcKeypairs && cryptoKeys.accountSalt) {
                    setUserData({
                        id: response.data.user.id,
                        crypto_keypairs: {
                            accountSalt: cryptoKeys.accountSalt,
                            pqcKeypairs: cryptoKeys.pqcKeypairs
                        }
                    })
                }
            }
            setUserDataLoaded(true)
        } catch (e) {
            console.warn("Failed to load user data for signing", e)
            setUserDataLoaded(true)
        }
    }

    const fetchFolders = async () => {
        setIsLoadingFolders(true)
        try {
            const response = await apiClient.getFolders()

            if (response.success && response.data) {
                // Get master key for decryption
                let masterKey: Uint8Array | null = null;
                try {
                    masterKey = masterKeyManager.getMasterKey();
                } catch (err) {
                    console.warn('Could not retrieve master key for folder name decryption', err);
                }

                // Decrypt folder names from the API response
                const activeFolders = await Promise.all((response.data as Record<string, unknown>[])
                    .filter((folder) => typeof folder.path === 'string' && !(folder.path as string).includes('/trash'))
                    .map(async (folder) => {
                        const f = folder as Record<string, unknown>;
                        let displayName = (f.encryptedName as string) || '';
                        if (f.encryptedName && f.nameSalt && masterKey) {
                            try {
                                displayName = await decryptFilename(f.encryptedName as string, f.nameSalt as string, masterKey);
                            } catch (err) {
                                console.warn(`Failed to decrypt folder name for ${(f.id as string) || 'unknown'}:`, err);
                                displayName = (f.encryptedName as string) || 'Unknown Folder';
                            }
                        } else {
                            displayName = (f.encryptedName as string) || 'Unknown Folder';
                        }

                        return {
                            id: f.id as string,
                            name: displayName,
                            encryptedName: f.encryptedName as string | undefined,
                            nameSalt: f.nameSalt as string | undefined,
                            parentId: f.parentId as string | null,
                            path: f.path as string,
                            createdAt: f.createdAt as string,
                            updatedAt: f.updatedAt as string
                        };
                    }));

                // Build folder tree with only root level folders initially
                const rootFolders: Folder[] = activeFolders
                    .filter(folder => !folder.parentId || folder.parentId === 'root')
                    .map(folder => ({
                        ...folder,
                        isExpanded: false,
                        level: 0,
                        children: [],
                        hasExploredChildren: false
                    }))

                // Add root folder
                const rootFolder: Folder = {
                    id: "root",
                    name: "My Files",
                    parentId: null,
                    path: "/",
                    createdAt: "",
                    updatedAt: "",
                    isExpanded: true,
                    level: 0,
                    children: rootFolders
                }

                setFolders([rootFolder])
            } else {
                toast.error(`Failed to load folders: ${response.error}`)
            }
        } catch {
            toast.error("Failed to load folders")
        } finally {
            setIsLoadingFolders(false)
        }
    }

    const toggleFolderExpansion = async (folder: Folder) => {
        if (folder.isExpanded) {
            setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: false }))
        } else {
            if (folder.children && folder.children.length > 0) {
                setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: true }))
            } else if (folder.hasExploredChildren) {
                setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: true }))
            } else {
                setFolders(prev => updateFolderInTree(prev, folder.id, { isLoading: true }))

                try {
                    const response = await apiClient.getFolderContents(folder.id)

                    if (response.success && response.data) {
                        let masterKey: Uint8Array | null = null;
                        try {
                            masterKey = masterKeyManager.getMasterKey();
                        } catch (err) {
                            console.warn('Could not retrieve master key for subfolder name decryption', err);
                        }

                        const subfolders = await Promise.all(((response.data.folders || []) as FolderContentItem[]).map(async (subfolder) => {
                            const sf = subfolder as FolderContentItem;
                            let displayName = sf.encryptedName || '';
                            if (sf.encryptedName && sf.nameSalt && masterKey) {
                                try {
                                    displayName = await decryptFilename(sf.encryptedName, sf.nameSalt, masterKey);
                                } catch (err) {
                                    console.warn(`Failed to decrypt subfolder name for ${sf.id || 'unknown'}:`, err);
                                    displayName = sf.encryptedName || 'Unknown Folder';
                                }
                            } else {
                                displayName = sf.encryptedName || 'Unknown Folder';
                            }

                            return {
                                id: sf.id,
                                name: displayName || 'Unknown Folder',
                                encryptedName: sf.encryptedName,
                                nameSalt: sf.nameSalt,
                                parentId: folder.id,
                                path: sf.path,
                                createdAt: sf.createdAt,
                                updatedAt: sf.updatedAt,
                                isExpanded: false,
                                level: (folder.level || 0) + 1,
                                children: [],
                                hasExploredChildren: false
                            };
                        }))

                        setFolders(prev => updateFolderInTree(prev, folder.id, {
                            isExpanded: true,
                            isLoading: false,
                            children: subfolders,
                            hasExploredChildren: true
                        }))
                    } else {
                        setFolders(prev => updateFolderInTree(prev, folder.id, {
                            isExpanded: true,
                            isLoading: false,
                            hasExploredChildren: true
                        }))
                    }
                } catch {
                    setFolders(prev => updateFolderInTree(prev, folder.id, {
                        isExpanded: true,
                        isLoading: false,
                        hasExploredChildren: true
                    }))
                }
            }
        }
    }

    const updateFolderInTree = (folders: Folder[], folderId: string, updates: Partial<Folder>): Folder[] => {
        return folders.map(folder => {
            if (folder.id === folderId) {
                return { ...folder, ...updates }
            }
            if (folder.children) {
                return {
                    ...folder,
                    children: updateFolderInTree(folder.children, folderId, updates)
                }
            }
            return folder
        })
    }

    const renderFolderTree = (folderList: Folder[]): React.ReactElement[] => {
        return folderList.flatMap(folder => {
            const indentLevel = folder.level || 0
            const canExpand = folder.id !== 'root'

            return [
                <div key={folder.id}>
                    <button
                        onClick={() => setSelectedFolder(folder.id)}
                        className={`flex items-center gap-2 w-full p-2 rounded-md text-left hover:bg-accent transition-colors ${selectedFolder === folder.id ? "bg-accent ring-1 ring-ring" : ""
                            }`}
                        style={{ paddingLeft: `${8 + indentLevel * 20}px` }}
                    >
                        {canExpand ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleFolderExpansion(folder)
                                }}
                                className="p-1 hover:bg-muted rounded flex items-center justify-center"
                                style={{ width: '20px', height: '20px' }}
                            >
                                {folder.isLoading ? (
                                    <IconLoader2 className="h-3 w-3 animate-spin" />
                                ) : folder.isExpanded ? (
                                    <IconChevronDown className="h-3 w-3" />
                                ) : (
                                    <IconChevronRight className="h-3 w-3" />
                                )}
                            </button>
                        ) : (
                            <div className="w-5" />
                        )}
                        <IconFolder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{truncateFilename(folder.name)}</div>
                        </div>
                    </button>
                    {folder.isExpanded && folder.children && renderFolderTree(folder.children)}
                </div>
            ]
        })
    }

    const handleCopy = async () => {
        if (!selectedFolder || operationItems.length === 0) return

        setIsLoading(true)
        try {
            const results = []
            let successCount = 0
            let errorCount = 0
            const conflicts: Array<{ id: string; name: string; type: "file" | "folder"; conflictingItemId?: string }> = []

            for (const item of operationItems) {
                try {
                    let response;
                    const destFolderId = selectedFolder === 'root' ? null : selectedFolder;

                    // Compute HMAC and Sign Manifest
                    let nameHmac;
                    let signedManifest;
                    let encryptedFilename;
                    let filenameSalt;
                    let wrappedCek;
                    let cekNonce;

                    try {
                        nameHmac = await computeFilenameHmac(item.name, destFolderId);

                        // Re-encrypt filename & CEK for the copy to ensure it is readable by the current user
                        if (masterKeyManager.hasMasterKey()) {
                            try {
                                const masterKey = masterKeyManager.getMasterKey();

                                // 1. Re-encrypt Filename
                                const encResult = await import("@/lib/crypto").then(m => m.encryptFilename(item.name, masterKey));
                                encryptedFilename = encResult.encryptedFilename;
                                filenameSalt = encResult.filenameSalt;

                                // 2. Re-encrypt CEK if this is a shared file and we have the CEK cached
                                // (Dynamic import to avoid circular dep if any)
                                const { getCekForShare } = await import("@/lib/share-cache");
                                const { encryptData } = await import("@/lib/crypto");

                                // We check if there's a cached CEK for this item ID (from SharedFilesTable)
                                const cachedCek = getCekForShare(item.id);
                                if (cachedCek) {
                                    // Re-wrap the CEK with our master key so we can read the copied file
                                    const encCek = encryptData(cachedCek, masterKey);
                                    wrappedCek = encCek.encryptedData;
                                    cekNonce = encCek.nonce;
                                }
                            } catch (e) {
                                console.warn('Failed to encrypt filename/CEK for copy', e);
                            }
                        }

                        // IMPROVEMENT: Sign the copied file to ensure integrity
                        if (userData && masterKeyManager.hasMasterKey()) {
                            const privateKeys = await decryptUserPrivateKeys(userData);
                            if (item.type === 'file') {
                                signedManifest = await createSignedFileManifest(
                                    item.name,
                                    destFolderId,
                                    {
                                        ed25519PrivateKey: privateKeys.ed25519PrivateKey,
                                        ed25519PublicKey: privateKeys.ed25519PublicKey,
                                        dilithiumPrivateKey: privateKeys.dilithiumPrivateKey,
                                        dilithiumPublicKey: privateKeys.dilithiumPublicKey
                                    }
                                );
                            } else {
                                // Create signed folder manifest for ROOT folder copy
                                signedManifest = await createSignedFolderManifest(
                                    item.name,
                                    destFolderId,
                                    {
                                        ed25519PrivateKey: privateKeys.ed25519PrivateKey,
                                        ed25519PublicKey: privateKeys.ed25519PublicKey,
                                        dilithiumPrivateKey: privateKeys.dilithiumPrivateKey,
                                        dilithiumPublicKey: privateKeys.dilithiumPublicKey
                                    }
                                );
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to compute crypto data for copy', err);
                    }

                    if (item.type === 'file') {
                        response = await apiClient.copyFile(item.id, destFolderId, {
                            nameHmac,
                            encryptedFilename,
                            filenameSalt,
                            wrappedCek,
                            cekNonce,
                            // Spread signed manifest fields if available
                            ...(signedManifest ? {
                                manifestHash: signedManifest.manifestHash,
                                manifestSignatureEd25519: signedManifest.manifestSignatureEd25519,
                                manifestPublicKeyEd25519: signedManifest.manifestPublicKeyEd25519,
                                manifestSignatureDilithium: signedManifest.manifestSignatureDilithium,
                                manifestPublicKeyDilithium: signedManifest.manifestPublicKeyDilithium,
                                manifestCreatedAt: signedManifest.manifestCreatedAt,
                                algorithmVersion: signedManifest.algorithmVersion
                            } : {})
                        });
                    } else {
                        response = await apiClient.copyFolder(item.id, destFolderId, {
                            nameHmac,
                            encryptedName: encryptedFilename,
                            nameSalt: filenameSalt,
                            ...(signedManifest ? {
                                manifestHash: signedManifest.manifestHash,
                                manifestSignatureEd25519: signedManifest.manifestSignatureEd25519,
                                manifestPublicKeyEd25519: signedManifest.manifestPublicKeyEd25519,
                                manifestSignatureDilithium: signedManifest.manifestSignatureDilithium,
                                manifestPublicKeyDilithium: signedManifest.manifestPublicKeyDilithium,
                                manifestCreatedAt: signedManifest.manifestCreatedAt,
                                algorithmVersion: signedManifest.algorithmVersion
                            } : {})
                        });

                    }

                    if (response.success) {
                        successCount++
                        results.push({ item: item.name, success: true })
                    } else {
                        // Check for conflict specific codes
                        // ApiClient wraps error responses in data
                        const responseData = response.data as Record<string, unknown> | undefined;
                        const errorCode = responseData?.code;

                        if (errorCode === 'CONFLICT_FILE_EXISTS' || errorCode === 'CONFLICT_FOLDER_EXISTS') {
                            conflicts.push({
                                id: item.id,
                                name: item.name,
                                type: item.type,
                                conflictingItemId: responseData?.conflictingItemId as string | undefined
                            })
                        } else {
                            errorCount++
                            results.push({ item: item.name, success: false, error: response.error })
                        }
                    }
                } catch {
                    errorCount++
                    results.push({ item: item.name, success: false, error: 'Network error' })
                }
            }

            if (conflicts.length > 0) {
                if (successCount > 0) {
                    toast.success(`${successCount} item${successCount > 1 ? 's' : ''} copied successfully`)
                }
                // Pass conflicts to parent
                onConflict?.(conflicts, selectedFolder === 'root' ? null : selectedFolder);
                // Close this modal
                setOpen(false);
                return;
            }

            if (successCount > 0) {
                if (errorCount === 0) {
                    toast.success(`${successCount} item${successCount > 1 ? 's' : ''} copied successfully`)
                } else {
                    toast.success(`${successCount} item${successCount > 1 ? 's' : ''} copied successfully, ${errorCount} failed`)
                }
            } else if (errorCount > 0) {
                const firstError = results.find(r => !r.success && r.error)?.error;
                toast.error(firstError || `Failed to copy any items`)
            }

            setSelectedFolder(null)
            setOpen(false)
            onItemCopied?.()
        } catch {
            toast.error(`Failed to copy items`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {externalOpen === undefined && externalOnOpenChange === undefined ? (
                <DialogTrigger asChild>
                    {children}
                </DialogTrigger>
            ) : (
                children
            )}
            <DialogContent className="sm:max-w-lg max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconCopy className="h-5 w-5" />
                        {operationTitle}
                    </DialogTitle>
                    <DialogDescription>
                        {operationDescription}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Current location</Label>
                        <Badge variant="outline" className="w-fit">
                            <IconFolder className="h-3 w-3 mr-1" />
                            My Files
                        </Badge>
                    </div>
                    <div className="grid gap-2">
                        <Label>Select destination</Label>
                        <div className="border rounded-md max-h-64 overflow-y-auto">
                            {isLoadingFolders ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="flex items-center gap-2">
                                        <IconLoader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm text-muted-foreground">Loading folders...</span>
                                    </div>
                                </div>
                            ) : folders.length === 0 ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="text-sm text-muted-foreground">No folders available</span>
                                </div>
                            ) : (
                                <div className="p-2">
                                    {renderFolderTree(folders)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleCopy}
                        disabled={!selectedFolder || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                                Copying...
                            </>
                        ) : (
                            "Copy Here"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
