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
import { IconFolder, IconFile, IconPhoto, IconVideo, IconMusic, IconFileText, IconArchive, IconChevronRight, IconChevronDown, IconLoader2, IconShare } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import type { FolderContentItem, FileContentItem } from "@/lib/api"
import { decryptFilename } from "@/lib/crypto"
import { masterKeyManager } from "@/lib/master-key"
import { truncateFilename } from "@/lib/utils"

interface SharePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelected: (fileId: string, fileName: string, fileType: "file" | "folder") => void
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
  is_shared: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: Folder[];
  level?: number;
  hasExploredChildren?: boolean; // Track if we've tried to load children
  decryptedName?: string; // Display name after decryption
}

interface FileItem {
  id: string;
  name: string;
  type: 'file';
  mimeType?: string;
  size?: number;
  is_shared?: boolean;
}

export function SharePickerModal({ open, onOpenChange, onFileSelected }: SharePickerModalProps) {
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [folderFiles, setFolderFiles] = useState<Record<string, FileItem[]>>({})

  // Helper function to decrypt folder name
  const decryptFolderName = useCallback(async (encryptedName: string, nameSalt: string): Promise<string> => {
    try {
      if (!masterKeyManager.hasMasterKey()) {
        return encryptedName;
      }
      const masterKey = masterKeyManager.getMasterKey();
      return await decryptFilename(encryptedName, nameSalt, masterKey);
    } catch (err) {
      console.warn(`Failed to decrypt folder name:`, err);
      return encryptedName;
    }
  }, [])

  // Fetch folders and files when modal opens
  useEffect(() => {
    if (open) {
      fetchFoldersAndFiles()
    }
  }, [open])

  const fetchFoldersAndFiles = async () => {
    setIsLoadingFolders(true)
    try {
      const response = await apiClient.getFolderContents('root')

      if (response.success && response.data) {
        // Filter out folders that are in trash
        const activeFolders = ((response.data.folders || []) as FolderContentItem[]).filter(folder => typeof folder.path === 'string' && !(folder.path.includes('/trash')))

        // Decrypt folder names and build folder tree with only root level folders initially
        const rootFolders: Folder[] = await Promise.all(activeFolders
          .map(async (folder) => {
            const f = folder as FolderContentItem;
            const decryptedName = await decryptFolderName(f.encryptedName, f.nameSalt);
            return {
              id: f.id,
              encryptedName: f.encryptedName,
              nameSalt: f.nameSalt,
              decryptedName: decryptedName,
              isExpanded: false,
              level: 0,
              children: [], // Start with empty children, load lazily
              hasExploredChildren: false, // Haven't tried to load children yet
              parentId: f.parentId,
              path: f.path,
              type: 'folder',
              createdAt: f.createdAt,
              updatedAt: f.updatedAt,
              is_shared: !!f.is_shared
            }
          })
        )

        // Add root folder
        const rootFolder: Folder = {
          id: "root",
          encryptedName: "root",
          nameSalt: "",
          decryptedName: "My Files",
          parentId: null,
          path: "/",
          type: "folder",
          createdAt: "",
          updatedAt: "",
          is_shared: false,
          isExpanded: true,
          level: 0,
          children: rootFolders
        }

        setFolders([rootFolder])

        // Set root level files - use Promise.all since decryptFilename is async
        const rootFiles: FileItem[] = await Promise.all(((response.data.files || []) as FileContentItem[]).map(async (file) => {
          const f = file as FileContentItem;
          let displayName = '';
          
          // Always try to decrypt if we have the encrypted name and salt
          if (f.encryptedFilename && f.filenameSalt) {
            try {
              if (masterKeyManager.hasMasterKey()) {
                const masterKey = masterKeyManager.getMasterKey();
                displayName = await decryptFilename(f.encryptedFilename as string, f.filenameSalt as string, masterKey);
              } else {
                // No master key, use encrypted name as fallback
                displayName = f.encryptedFilename as string;
              }
            } catch (err) {
              console.warn(`Failed to decrypt filename for file ${(f.id as string) || 'unknown'}:`, err);
              // Keep encrypted name as fallback
              displayName = f.encryptedFilename as string;
            }
          }
          
          // Final fallback if still empty
          if (!displayName || displayName.trim() === '') {
            displayName = 'Unknown File';
          }

          return {
            id: f.id as string,
            name: displayName,
            type: 'file' as const,
            mimeType: f.mimeType as string | undefined,
            size: f.size as number | undefined,
            is_shared: !!f.is_shared
          }
        }))

        setFiles(rootFiles)
      } else {
        toast.error(`Failed to load files: ${response.error}`)
      }
    } catch (error) {
      console.error("Failed to fetch folders and files:", error)
      toast.error("Failed to load files")
    } finally {
      setIsLoadingFolders(false)
    }
  }

  const toggleFolderExpansion = async (folder: Folder) => {
    if (folder.isExpanded) {
      // Collapse
      setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: false }))
    } else {
      // Check if children are already loaded
      if (folder.children && folder.children.length > 0) {
        // Children already loaded, just expand
        setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: true }))
      } else if (folder.hasExploredChildren) {
        // We've already explored and there are no children, just expand (show empty state)
        setFolders(prev => updateFolderInTree(prev, folder.id, { isExpanded: true }))
      } else {
        // Load children lazily
        setFolders(prev => updateFolderInTree(prev, folder.id, { isLoading: true }))

        try {
          // Get subfolders and files of this folder
          const response = await apiClient.getFolderContents(folder.id)

          if (response.success && response.data) {
            const subfolders = await Promise.all(((response.data.folders || []) as FolderContentItem[]).map(async (subfolder) => {
              const sf = subfolder as FolderContentItem;
              const decryptedName = await decryptFolderName(sf.encryptedName, sf.nameSalt);
              return {
                id: sf.id,
                encryptedName: sf.encryptedName,
                nameSalt: sf.nameSalt,
                decryptedName: decryptedName,
                parentId: folder.id,
                isExpanded: false,
                level: (folder.level || 0) + 1,
                children: [],
                hasExploredChildren: false,
                type: 'folder',
                path: sf.path,
                createdAt: sf.createdAt,
                updatedAt: sf.updatedAt,
                is_shared: !!sf.is_shared
              }
            }))

            // Store files for this folder - use Promise.all since decryptFilename is async
            const folderFilesData: FileItem[] = await Promise.all(((response.data.files || []) as FileContentItem[]).map(async (file) => {
              const f = file as FileContentItem;
              let displayName = '';
               
              // Always try to decrypt if we have the encrypted name and salt
              if (f.encryptedFilename && f.filenameSalt) {
                try {
                  if (masterKeyManager.hasMasterKey()) {
                    const masterKey = masterKeyManager.getMasterKey();
                    displayName = await decryptFilename(f.encryptedFilename as string, f.filenameSalt as string, masterKey);
                  } else {
                    // No master key, use encrypted name as fallback
                    displayName = f.encryptedFilename as string;
                  }
                } catch (err) {
                  console.warn(`Failed to decrypt filename for file ${(f.id as string) || 'unknown'}:`, err);
                  // Keep encrypted name as fallback
                  displayName = f.encryptedFilename as string;
                }
              }
              
              // Final fallback if still empty
              if (!displayName || displayName.trim() === '') {
                displayName = 'Unknown File';
              }

              return {
                id: f.id as string,
                name: displayName,
                type: 'file' as const,
                mimeType: f.mimeType as string | undefined,
                size: f.size as number | undefined,
                is_shared: !!f.is_shared
              }
            }))

            setFolderFiles(prev => ({
              ...prev,
              [folder.id]: folderFilesData
            }))

            // Update the folder with its children
            setFolders(prev => updateFolderInTree(prev, folder.id, {
              isExpanded: true,
              isLoading: false,
              children: subfolders,
              hasExploredChildren: true
            }))
          } else {
            // No children or error, mark as explored and expand
            setFolders(prev => updateFolderInTree(prev, folder.id, {
              isExpanded: true,
              isLoading: false,
              hasExploredChildren: true
            }))
          }
        } catch (error) {
          console.error('Failed to load subfolders:', error)
          // Mark as explored and expand anyway
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

  const getFileIcon = (mimeType?: string) => {
    if (mimeType?.startsWith('image/')) return <IconPhoto className="h-4 w-4 text-green-500" />
    if (mimeType?.startsWith('video/')) return <IconVideo className="h-4 w-4 text-purple-500" />
    if (mimeType?.startsWith('audio/')) return <IconMusic className="h-4 w-4 text-orange-500" />
    if (mimeType?.includes('pdf')) return <IconFileText className="h-4 w-4 text-red-500" />
    if (mimeType?.includes('zip') || mimeType?.includes('rar')) return <IconArchive className="h-4 w-4 text-yellow-500" />
    if (mimeType?.includes('text')) return <IconFileText className="h-4 w-4 text-gray-500" />
    return <IconFile className="h-4 w-4 text-gray-500" />
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return ''
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const renderFolderTree = (folderList: Folder[]): React.ReactElement[] => {
    return folderList.flatMap(folder => {
      const indentLevel = folder.level || 0
      const canExpand = folder.id !== 'root' // Root folder doesn't need chevron

      return [
        <div key={folder.id}>
          <button
            onClick={() => setSelectedItem({ id: folder.id, name: folder.decryptedName || folder.encryptedName, type: "folder" })}
            className={`flex items-center gap-2 w-full p-2 rounded-md text-left hover:bg-accent transition-colors ${
              selectedItem?.id === folder.id ? "bg-accent ring-1 ring-ring" : ""
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
              <div className="font-medium text-sm truncate">{truncateFilename(folder.decryptedName || folder.encryptedName)}</div>
            </div>
            {folder.is_shared && (
              <IconShare className="h-3 w-3 text-blue-500 flex-shrink-0 ml-1" />
            )}
          </button>

          {/* Render files in this folder when expanded */}
          {folder.isExpanded && folder.id !== 'root' && (
            <div className="ml-4">
              {(() => {
                // Get files for this specific folder
                const currentFolderFiles = folderFiles[folder.id] || []

                return currentFolderFiles.map(file => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedItem({ id: file.id, name: file.name, type: "file" })}
                    className={`flex items-center gap-2 w-full p-2 rounded-md text-left hover:bg-accent transition-colors ${
                      selectedItem?.id === file.id ? "bg-accent ring-1 ring-ring" : ""
                    }`}
                    style={{ paddingLeft: `${8 + (indentLevel + 1) * 20}px` }}
                  >
                    <div className="w-5" />
                    {getFileIcon(file.mimeType)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{truncateFilename(file.name)}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {file.is_shared && (
                        <IconShare className="h-3 w-3 text-blue-500" />
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </button>
                ))
              })()}
            </div>
          )}

          {folder.isExpanded && folder.children && renderFolderTree(folder.children)}
        </div>
      ]
    })
  }

  const handleShare = async () => {
    if (!selectedItem) return

    setIsLoading(true)
    try {
      onFileSelected(selectedItem.id, selectedItem.name, selectedItem.type)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to select item for sharing:", error)
      toast.error("Failed to select item")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFolder className="h-5 w-5" />
            Select File to Share
          </DialogTitle>
          <DialogDescription>
            Choose a file or folder to create a share link.
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
            <Label>Select file or folder</Label>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {isLoadingFolders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading files...</span>
                  </div>
                </div>
              ) : folders.length === 0 && files.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-muted-foreground">No files available</span>
                </div>
              ) : (
                <div className="p-2">
                  {/* Render folder tree first */}
                  {renderFolderTree(folders)}
                  {/* Render root level files after folders */}
                  {files.map(file => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedItem({ id: file.id, name: file.name, type: "file" })}
                      className={`flex items-center gap-2 w-full p-2 rounded-md text-left hover:bg-accent transition-colors ${
                        selectedItem?.id === file.id ? "bg-accent ring-1 ring-ring" : ""
                      }`}
                    >
                      <div className="w-5" />
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{file.name}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {file.is_shared && (
                          <IconShare className="h-3 w-3 text-blue-500" />
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleShare}
            disabled={!selectedItem || isLoading}
          >
            {isLoading ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Selecting...
              </>
            ) : (
              "Share This"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}