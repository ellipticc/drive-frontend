"use client"

import { useState, useEffect, useCallback } from "react"
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
import { IconFolder, IconChevronRight, IconChevronDown, IconLoader2 } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"

interface MoveToFolderModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder"
  items?: Array<{ id: string; name: string; type: "file" | "folder" }> // For bulk operations
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onItemMoved?: () => void
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
  hasExploredChildren?: boolean // Track if we've tried to load children
}

export function MoveToFolderModal({ children, itemId = "", itemName = "item", itemType = "file", items, open: externalOpen, onOpenChange: externalOnOpenChange, onItemMoved }: MoveToFolderModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // Determine if this is a bulk operation
  const isBulkOperation = items && items.length > 0
  const operationItems = isBulkOperation ? items : [{ id: itemId, name: itemName, type: itemType }]
  const operationTitle = isBulkOperation ? `Move ${operationItems.length} item${operationItems.length > 1 ? 's' : ''} to Folder` : `Move to Folder`
  const operationDescription = isBulkOperation 
    ? `Choose a destination folder for ${operationItems.length} selected item${operationItems.length > 1 ? 's' : ''}.`
    : `Choose a destination folder for "${itemName}".`

  // Fetch folders when modal opens
  useEffect(() => {
    if (open) {
      fetchFolders()
    }
  }, [open])

  const fetchFolders = async () => {
    setIsLoadingFolders(true)
    try {
      const response = await apiClient.getFolders()

      if (response.success && response.data) {
        // Filter out folders that are in trash (we'll assume folders with path containing '/trash' are in trash)
        const activeFolders = response.data.filter((folder: Folder) => 
          !folder.path.includes('/trash')
        )

        // Build folder tree with only root level folders initially
        const rootFolders: Folder[] = activeFolders
          .filter(folder => !folder.parentId || folder.parentId === 'root')
          .map(folder => ({
            ...folder,
            isExpanded: false,
            level: 0,
            children: [], // Start with empty children, load lazily
            hasExploredChildren: false // Haven't tried to load children yet
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
    } catch (error) {
      // console.error("Failed to fetch folders:", error)
      toast.error("Failed to load folders")
    } finally {
      setIsLoadingFolders(false)
    }
  }

  // Removed buildFolderTree function - using lazy loading instead

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
          // Get subfolders of this folder
          const response = await apiClient.getFolderContents(folder.id)
          
          if (response.success && response.data) {
            const subfolders = (response.data.folders || []).map((subfolder: any) => ({
              id: subfolder.id,
              name: subfolder.name,
              parentId: folder.id,
              path: subfolder.path,
              createdAt: subfolder.createdAt,
              updatedAt: subfolder.updatedAt,
              isExpanded: false,
              level: (folder.level || 0) + 1,
              children: [],
              hasExploredChildren: false
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
          // console.error('Failed to load subfolders:', error)
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

  const renderFolderTree = (folderList: Folder[]): React.ReactElement[] => {
    return folderList.flatMap(folder => {
      const indentLevel = folder.level || 0
      const canExpand = folder.id !== 'root' // Root folder doesn't need chevron
      
      return [
        <div key={folder.id}>
          <button
            onClick={() => setSelectedFolder(folder.id)}
            className={`flex items-center gap-2 w-full p-2 rounded-md text-left hover:bg-accent transition-colors ${
              selectedFolder === folder.id ? "bg-accent ring-1 ring-ring" : ""
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
              <div className="font-medium text-sm truncate">{folder.name}</div>
            </div>
          </button>
          {folder.isExpanded && folder.children && renderFolderTree(folder.children)}
        </div>
      ]
    })
  }

  const handleMove = async () => {
    if (!selectedFolder || operationItems.length === 0) return

    setIsLoading(true)
    try {
      const results = []
      let successCount = 0
      let errorCount = 0

      // Process each item
      for (const item of operationItems) {
        try {
          let response;

          if (item.type === 'file') {
            response = await apiClient.moveFileToFolder(item.id, selectedFolder === 'root' ? null : selectedFolder)
          } else {
            response = await apiClient.moveFolder(item.id, selectedFolder === 'root' ? null : selectedFolder)
          }

          if (response.success) {
            successCount++
            results.push({ item: item.name, success: true })
          } else {
            errorCount++
            results.push({ item: item.name, success: false, error: response.error })
          }
        } catch (error) {
          errorCount++
          results.push({ item: item.name, success: false, error: 'Network error' })
        }
      }

      // Show appropriate toast messages
      if (successCount > 0) {
        if (errorCount === 0) {
          toast.success(`${successCount} item${successCount > 1 ? 's' : ''} moved successfully`)
        } else {
          toast.success(`${successCount} item${successCount > 1 ? 's' : ''} moved successfully, ${errorCount} failed`)
        }
      } else {
        toast.error(`Failed to move any items`)
      }

      setSelectedFolder(null)
      setOpen(false)
      onItemMoved?.() // Refresh the parent component
    } catch (error) {
      // console.error("Failed to move items:", error)
      toast.error(`Failed to move items`)
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
            <IconFolder className="h-5 w-5" />
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
            onClick={handleMove}
            disabled={!selectedFolder || isLoading}
          >
            {isLoading ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              "Move Here"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
