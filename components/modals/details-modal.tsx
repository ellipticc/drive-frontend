"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { IconFile, IconFolder, IconCalendar, IconUser, IconInfoCircle, IconDatabase, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { truncateFilename } from "@/lib/utils"

interface DetailsModalProps {
  children?: React.ReactNode
  itemId?: string
  itemName?: string
  itemType?: "file" | "folder"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DetailsModal({
  children,
  itemId = "",
  itemName = "example-file.pdf",
  itemType = "file",
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}: DetailsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [itemDetails, setItemDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null)

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

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
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };

    // Add ordinal suffix to day
    const day = date.getDate();
    const ordinalSuffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    const formatted = date.toLocaleDateString('en-US', options);
    const parts = formatted.split(', ');
    if (parts.length >= 2) {
      const datePart = parts[0];
      const timePart = parts[1];
      // Insert ordinal suffix
      const dayMatch = datePart.match(/(\w+)\s(\d+)/);
      if (dayMatch) {
        const month = dayMatch[1];
        const dayNum = parseInt(dayMatch[2]);
        const ordinalDay = `${dayNum}${ordinalSuffix(dayNum)}`;
        return `${month} ${ordinalDay} ${date.getFullYear()}, ${timePart}`;
      }
    }
    return formatted;
  };

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
          <DialogTitle className="flex items-center gap-2">
            {itemType === "file" ? (
              <IconFile className="h-5 w-5" />
            ) : (
              <IconFolder className="h-5 w-5" />
            )}
            {truncateFilename(itemName)}
          </DialogTitle>
          <DialogDescription>
            View details and properties of this {itemType}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading details...</span>
            </div>
          ) : itemDetails ? (
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Type</Label>
                <Badge variant="outline" className="capitalize">
                  {itemType}
                </Badge>
              </div>

              <Separator />

              {itemType === "file" && itemDetails.size && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <IconDatabase className="h-4 w-4" />
                    Size
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {itemDetails.size ? formatFileSize(itemDetails.size) : 'Unknown'}
                  </span>
                </div>
              )}

              {itemDetails.createdAt && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Created
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(itemDetails.createdAt)}
                  </span>
                </div>
              )}

              {itemDetails.updatedAt && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Modified
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(itemDetails.updatedAt)}
                  </span>
                </div>
              )}

              <Separator />

              {itemDetails.path && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <IconFolder className="h-4 w-4" />
                    Location
                  </Label>
                  <span className="text-sm text-muted-foreground text-right max-w-32 truncate">
                    {itemDetails.path}
                  </span>
                </div>
              )}

              {itemType === "file" && itemDetails.mimeType && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">MIME Type</Label>
                  <span className="text-sm text-muted-foreground">{itemDetails.mimeType}</span>
                </div>
              )}

              {itemType === "file" && itemDetails.sha256Hash && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">SHA256</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-[var(--font-jetbrains-mono)] font-semibold tracking-wider"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(itemDetails.sha256Hash!);
                          setCopiedHashId(itemId);
                          setTimeout(() => setCopiedHashId(null), 500);
                        }}
                      >
                        {itemDetails.sha256Hash.substring(0, 5)}...{itemDetails.sha256Hash.substring(itemDetails.sha256Hash.length - 5)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent 
                      className="max-w-none whitespace-nowrap font-[var(--font-jetbrains-mono)] font-semibold tracking-wider"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(itemDetails.sha256Hash!);
                        setCopiedHashId(itemId);
                        setTimeout(() => setCopiedHashId(null), 500);
                      }}
                    >
                      <p className={`text-xs cursor-pointer transition-all duration-300 ${copiedHashId === itemId ? 'animate-pulse bg-primary/20 text-primary scale-105' : ''}`}>{itemDetails.sha256Hash}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">No details available</span>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}