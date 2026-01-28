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

interface MoveToTrashModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onItemMoved?: () => void
}

export function MoveToTrashModal({ children, itemId = "", itemName = "item", itemType = "file", open: externalOpen, onOpenChange: externalOnOpenChange, onItemMoved }: MoveToTrashModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  const handleMoveToTrash = async () => {
    if (!itemId || !itemType) return

    setIsLoading(true)
    try {
      let response;
      if (itemType === 'file') {
        response = await apiClient.moveFileToTrash(itemId)
      } else {
        response = await apiClient.moveFolderToTrash(itemId)
      }

      if (response.success) {
        toast.success(`${itemType} moved to trash successfully`)
        setOpen(false)
        onItemMoved?.()
      } else {
        toast.error(`Failed to move ${itemType} to trash`)
      }
    } catch (error) {
      console.error("Failed to move item to trash:", error)
      toast.error(`Failed to move ${itemType} to trash`)
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
          <DialogTitle>Move to Trash</DialogTitle>
          <DialogDescription className="mt-1">
            You can restore this {itemType} from the trash later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Move <strong>&quot;{truncateFilename(itemName)}&quot;</strong> to the trash?
            {itemType === "folder" && " This will also move all files inside this folder."}
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
            onClick={handleMoveToTrash}
            disabled={isLoading}
          >
            {isLoading ? (
              "Moving..."
            ) : (
              <>
                <IconTrash className="h-4 w-4 mr-2" />
                Move to Trash
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
