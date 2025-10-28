"use client"

import { useState, useRef, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconFile, IconFolder, IconEdit } from "@tabler/icons-react"

interface RenameModalProps {
  children?: React.ReactNode
  itemName?: string
  itemType?: "file" | "folder"
  onRename?: (newName: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RenameModal({
  children,
  itemName = "example-file.pdf",
  itemType = "file",
  onRename,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: RenameModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [newName, setNewName] = useState(itemName)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use external state if provided, otherwise internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // Automatically focus & select text when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setNewName(itemName)
      requestAnimationFrame(() => {
        inputRef.current!.focus()
        inputRef.current!.select()
      })
    }
  }, [open, itemName])

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === itemName) {
      setOpen(false)
      return
    }

    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // console.log(`Renaming ${itemType} "${itemName}" to "${newName.trim()}"`)

      // Call the onRename callback if provided
      onRename?.(newName.trim())

      setOpen(false)
    } catch (error) {
      // console.error("Failed to rename item:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newName.trim() && newName.trim() !== itemName) {
      handleRename()
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      ) : (
        children
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconEdit className="h-5 w-5" />
            Rename {itemName}
          </DialogTitle>
          <DialogDescription>
            Enter a new name for this {itemType}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">New name</Label>
            <div className="flex items-center gap-2">
              {itemType === "file" ? (
                <IconFile className="h-4 w-4 text-muted-foreground" />
              ) : (
                <IconFolder className="h-4 w-4 text-muted-foreground" />
              )}
              <Input
                ref={inputRef}
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
                autoFocus
              />
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
            onClick={handleRename}
            disabled={!newName.trim() || newName.trim() === itemName || isLoading}
          >
            {isLoading ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
