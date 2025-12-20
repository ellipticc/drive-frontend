"use client"

import { useState } from "react"
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
import { IconTrash, IconAlertTriangle } from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { truncateFilename } from "@/lib/utils"

interface DeletePermanentlyModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onItemDeleted?: () => void
  onStorageFreed?: (storageFreed: number) => void
}

export function DeletePermanentlyModal({ children, itemId = "", itemName = "item", itemType = "file", open: externalOpen, onOpenChange: externalOnOpenChange, onItemDeleted, onStorageFreed }: DeletePermanentlyModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  const handleDeletePermanently = async () => {
    if (!itemId || !itemType) return

    setIsLoading(true)
    try {
      let response;
      if (itemType === 'file') {
        response = await apiClient.deleteFilePermanently(itemId)
      } else {
        response = await apiClient.deleteFolderPermanently(itemId)
      }

      if (response.success) {
        toast.success(`${itemType} permanently deleted successfully`)
        setOpen(false)
        onItemDeleted?.()
        
        // Update storage instantly if storage was freed
        if (response.data?.storageFreed && response.data.storageFreed > 0) {
          onStorageFreed?.(response.data.storageFreed)
        }
      } else {
        toast.error(`Failed to delete ${itemType}`)
      }
    } catch (error) {
      // console.error("Failed to delete item permanently:", error)
      toast.error(`Failed to delete ${itemType}`)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete Permanently</DialogTitle>
              <DialogDescription className="mt-1">
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete <strong>&quot;{truncateFilename(itemName)}&quot;</strong>?
            {itemType === "folder" && " This will also permanently delete all files inside this folder."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            This action will free up storage space and cannot be reversed.
          </p>
        </div>
        <DialogFooter className="gap-2">
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
            variant="destructive"
            onClick={handleDeletePermanently}
            disabled={isLoading}
          >
            {isLoading ? (
              "Deleting..."
            ) : (
              <>
                <IconTrash className="h-4 w-4 mr-2" />
                Delete Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
