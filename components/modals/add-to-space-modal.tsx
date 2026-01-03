"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    IconFolder,
    IconFile,
    IconPhoto,
    IconVideo,
    IconMusic,
    IconChevronRight,
    IconChevronDown,
    IconLoader2,
    IconPlus
} from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import type { FolderContentItem, FileContentItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { truncateFilename } from "@/lib/utils"

interface AddToSpaceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    spaceId: string
    spaceName: string
    onItemAdded?: () => void
}

interface ItemSelection {
    id: string;
    name: string;
    type: "file" | "folder";
}

interface Folder {
    id: string;
    encryptedName: string;
    nameSalt: string;
    parentId: string | null;
    path: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    isExpanded?: boolean;
    isLoading?: boolean;
    children?: Folder[];
    level?: number;
    hasExploredChildren?: boolean;
    decryptedName?: string;
}

interface FileItem {
    id: string;
    name: string;
    type: 'file';
    mimeType?: string;
    size?: number;
}

export function AddToSpaceModal({ open, onOpenChange, spaceId, spaceName, onItemAdded }: AddToSpaceModalProps) {
    const [selectedItems, setSelectedItems] = useState<ItemSelection[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingFolders, setIsLoadingFolders] = useState(false)
    const [folders, setFolders] = useState<Folder[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [folderFiles, setFolderFiles] = useState<Record<string, FileItem[]>>({})

    const decryptFolderName = useCallback(async (encryptedName: string, nameSalt: string): Promise<string> => {
        try {
            if (!masterKeyManager.hasMasterKey()) return encryptedName;
            const masterKey = masterKeyManager.getMasterKey();
            return await decryptFilename(encryptedName, nameSalt, masterKey);
        } catch (err) {
            return encryptedName;
        }
    }, [])

    useEffect(() => {
        if (open) {
            setSelectedItems([]) // Reset selection on open
            fetchFoldersAndFiles()
        }
    }, [open])

    const fetchFoldersAndFiles = async () => {
        setIsLoadingFolders(true)
        try {
            const response = await apiClient.getFolderContents('root')
            if (response.success && response.data) {
                const activeFolders = ((response.data.folders || []) as FolderContentItem[]).filter(folder => typeof folder.path === 'string' && !(folder.path.includes('/trash')))

                const rootFolders: Folder[] = await Promise.all(activeFolders.map(async (f) => ({
                    id: f.id,
                    encryptedName: f.encryptedName,
                    nameSalt: f.nameSalt,
                    decryptedName: await decryptFolderName(f.encryptedName, f.nameSalt),
                    isExpanded: false,
                    level: 0,
                    children: [],
                    hasExploredChildren: false,
                    parentId: f.parentId,
                    path: f.path,
                    type: 'folder',
                    createdAt: f.createdAt,
                    updatedAt: f.updatedAt
                })))

                const rootFolder: Folder = {
                    id: "root", encryptedName: "root", nameSalt: "", decryptedName: "My Files",
                    parentId: null, path: "/", type: "folder", createdAt: "", updatedAt: "",
                    isExpanded: true, level: 0, children: rootFolders
                }
                setFolders([rootFolder])

                const rootFiles: FileItem[] = await Promise.all(((response.data.files || []) as FileContentItem[]).map(async (f) => ({
                    id: f.id,
                    name: f.encryptedFilename ? await decryptFilename(f.encryptedFilename, f.filenameSalt, masterKeyManager.getMasterKey()) : 'Unknown File',
                    type: 'file' as const,
                    mimeType: f.mimetype,
                    size: f.size
                })))
                setFiles(rootFiles)
            }
        } catch (error) {
            toast.error("Failed to load files")
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
            } else {
                setFolders(prev => updateFolderInTree(prev, folder.id, { isLoading: true }))
                try {
                    const response = await apiClient.getFolderContents(folder.id)
                    if (response.success && response.data) {
                        const subfolders = await Promise.all(((response.data.folders || []) as FolderContentItem[]).map(async (sf) => ({
                            id: sf.id,
                            encryptedName: sf.encryptedName,
                            nameSalt: sf.nameSalt,
                            decryptedName: await decryptFolderName(sf.encryptedName, sf.nameSalt),
                            parentId: folder.id,
                            isExpanded: false,
                            level: (folder.level || 0) + 1,
                            children: [],
                            hasExploredChildren: false,
                            type: 'folder',
                            path: sf.path,
                            createdAt: sf.createdAt,
                            updatedAt: sf.updatedAt
                        })))

                        const folderFilesData: FileItem[] = await Promise.all(((response.data.files || []) as FileContentItem[]).map(async (f) => ({
                            id: f.id,
                            name: f.encryptedFilename ? await decryptFilename(f.encryptedFilename, f.filenameSalt, masterKeyManager.getMasterKey()) : 'Unknown File',
                            type: 'file' as const,
                            mimeType: f.mimetype,
                            size: f.size
                        })))

                        setFolderFiles(prev => ({ ...prev, [folder.id]: folderFilesData }))
                        setFolders(prev => updateFolderInTree(prev, folder.id, {
                            isExpanded: true, isLoading: false, children: subfolders, hasExploredChildren: true
                        }))
                    }
                } catch (error) {
                    setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: true, isLoading: false, hasExploredChildren: true }))
                }
            }
        }
    }

    const updateFolderInTree = (folders: Folder[], folderId: string, updates: Partial<Folder>): Folder[] => {
        return folders.map(folder => {
            if (folder.id === folderId) return { ...folder, ...updates }
            if (folder.children) return { ...folder, children: updateFolderInTree(folder.children, folderId, updates) }
            return folder
        })
    }

    const toggleSelection = (id: string, name: string, type: "file" | "folder") => {
        setSelectedItems(prev => {
            const exists = prev.find(item => item.id === id)
            if (exists) {
                return prev.filter(item => item.id !== id)
            } else {
                return [...prev, { id, name, type }]
            }
        })
    }

    const handleAdd = async () => {
        if (selectedItems.length === 0) return
        setIsLoading(true)

        const fileIds = selectedItems.filter(i => i.type === 'file').map(i => i.id)
        const folderIds = selectedItems.filter(i => i.type === 'folder').map(i => i.id)

        try {
            let response;
            if (spaceId === "spaced-fixed") {
                response = await apiClient.setItemStarred({
                    fileIds,
                    folderIds,
                    isStarred: true
                })
            } else {
                response = await apiClient.addItemToSpace(spaceId, {
                    fileIds,
                    folderIds
                })
            }

            if (response.success) {
                toast.success(`Pinned ${selectedItems.length} items to ${spaceName}`)
                onItemAdded?.()
                onOpenChange(false)
            } else {
                toast.error(response.error || `Failed to add items`)
            }
        } catch (error) {
            toast.error("An error occurred during operation")
        } finally {
            setIsLoading(false)
        }
    }

    const getFileIcon = (mimeType?: string) => {
        if (mimeType?.startsWith('image/')) return <IconPhoto className="h-4 w-4 text-green-500" />
        if (mimeType?.startsWith('video/')) return <IconVideo className="h-4 w-4 text-purple-500" />
        if (mimeType?.startsWith('audio/')) return <IconMusic className="h-4 w-4 text-orange-500" />
        return <IconFile className="h-4 w-4 text-gray-500" />
    }

    const renderFolderTree = (folderList: Folder[]): React.ReactElement[] => {
        return folderList.flatMap(folder => {
            const indentLevel = folder.level || 0
            const canExpand = folder.id !== 'root'
            const isSelected = !!selectedItems.find(i => i.id === folder.id)

            return [
                <div key={folder.id}>
                    <div
                        className={`group flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors cursor-pointer ${isSelected ? "bg-accent/60" : "hover:bg-accent/40"}`}
                        style={{ paddingLeft: `${8 + indentLevel * 20}px` }}
                        onClick={() => toggleSelection(folder.id, folder.decryptedName || folder.encryptedName, "folder")}
                    >
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(folder.id, folder.decryptedName || folder.encryptedName, "folder")}
                            onClick={(e) => e.stopPropagation()}
                            className="mr-1"
                        />
                        {canExpand ? (
                            <div onClick={(e) => { e.stopPropagation(); toggleFolderExpansion(folder); }} className="p-1 hover:bg-muted rounded flex items-center justify-center w-5 h-5">
                                {folder.isLoading ? <IconLoader2 className="h-3 w-3 animate-spin" /> : folder.isExpanded ? <IconChevronDown className="h-3 w-3" /> : <IconChevronRight className="h-3 w-3" />}
                            </div>
                        ) : <div className="w-5" />}
                        <IconFolder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0 font-medium text-sm truncate">
                            {truncateFilename(folder.decryptedName || folder.encryptedName, 30)}
                        </div>
                    </div>
                    {folder.isExpanded && folder.id !== 'root' && (
                        <div>
                            {(folderFiles[folder.id] || []).map(file => {
                                const isFileSelected = !!selectedItems.find(i => i.id === file.id)
                                return (
                                    <div
                                        key={file.id}
                                        className={`group flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors cursor-pointer ${isFileSelected ? "bg-accent/60" : "hover:bg-accent/40"}`}
                                        style={{ paddingLeft: `${8 + (indentLevel + 1) * 20}px` }}
                                        onClick={() => toggleSelection(file.id, file.name, "file")}
                                    >
                                        <Checkbox
                                            checked={isFileSelected}
                                            onCheckedChange={() => toggleSelection(file.id, file.name, "file")}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mr-1"
                                        />
                                        <div className="w-5" />
                                        {getFileIcon(file.mimeType)}
                                        <div className="flex-1 min-w-0 font-medium text-sm truncate">
                                            {truncateFilename(file.name, 30)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {folder.isExpanded && folder.children && renderFolderTree(folder.children)}
                </div>
            ]
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-1 gap-0">
                <div className="p-6 pb-4">
                    <DialogHeader>
                        <DialogTitle>Add Items to {spaceName}</DialogTitle>
                        <DialogDescription>Select multiple files or folders to pin to this space.</DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
                    <div className="border rounded-md p-1 min-h-[300px]">
                        {isLoadingFolders ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-sm text-muted-foreground animate-in fade-in">
                                <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
                                Loading your files...
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {renderFolderTree(folders)}
                                {files.map(file => {
                                    const isFileSelected = !!selectedItems.find(i => i.id === file.id)
                                    return (
                                        <div
                                            key={file.id}
                                            className={`group flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors cursor-pointer ${isFileSelected ? "bg-accent/60" : "hover:bg-accent/40"}`}
                                            onClick={() => toggleSelection(file.id, file.name, "file")}
                                        >
                                            <Checkbox
                                                checked={isFileSelected}
                                                onCheckedChange={() => toggleSelection(file.id, file.name, "file")}
                                                onClick={(e) => e.stopPropagation()}
                                                className="mr-1"
                                            />
                                            <div className="w-5" />
                                            {getFileIcon(file.mimeType)}
                                            <div className="flex-1 min-w-0 font-medium text-sm truncate">
                                                {truncateFilename(file.name, 30)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-4 flex items-center justify-between border-t bg-muted/20">
                    <div className="text-xs text-muted-foreground font-medium">
                        {selectedItems.length > 0 ? (
                            <span className="text-primary">{selectedItems.length} items selected</span>
                        ) : (
                            "No items selected"
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleAdd} disabled={selectedItems.length === 0 || isLoading} className="min-w-[120px]">
                            {isLoading ? (
                                <><IconLoader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Adding...</>
                            ) : (
                                <><IconPlus className="h-3.5 w-3.5 mr-2" />Add to Space</>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
