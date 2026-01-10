"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  IconFile,
  IconFolder,
  IconCalendar,
  IconShieldCheck,
  IconAlertCircle,
  IconLoader2,
  IconDownload,
  IconCopy,
  IconCheck,
  IconLock,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient, FileInfo, FolderInfo } from "@/lib/api"
import { truncateFilename } from "@/lib/utils"

interface ItemDetails {
  filename?: string;
  encryptedFilename?: string;
  // Legacy snake_case aliases
  encrypted_filename?: string;
  filename_salt?: string;
  nameSalt?: string;
  parentId?: string | null;
  path?: string;
  encrypted_path?: string;
  encryptedPath?: string;
  path_salt?: string;
  pathSalt?: string;
  created_at?: string;
  createdAt?: string;
  updatedAt?: string;
  updated_at?: string;
  mimetype?: string;
  size?: number;
  is_shared?: boolean;
  sha_hash?: string | null;
  shaHash?: string | null;
  lockedUntil?: string | null;
  retentionMode?: string | null;
}
import { decryptFilename } from "@/lib/crypto"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false)
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null)
  const [decryptedFilename, setDecryptedFilename] = useState<string | null>(null)
  const [decryptedPath, setDecryptedPath] = useState<string | null>(null)
  const [signatureStatus, setSignatureStatus] = useState<{
    verified: boolean | null
    signerEmail?: string
    error?: string
    status?: string
  } | null>(null)

  const open = externalOpen ?? internalOpen
  const setOpen = externalOnOpenChange ?? setInternalOpen

  useEffect(() => {
    if (open && itemId) {
      loadItemDetailsAndVerify()
    }
  }, [open, itemId])

  // Decrypt filename when itemDetails changes
  useEffect(() => {
    const decryptFilenameAsync = async () => {
      // Handle different field names for files vs folders
      const encryptedName = itemDetails?.encrypted_filename || itemDetails?.encryptedFilename
      const filenameSalt = itemDetails?.filename_salt || itemDetails?.nameSalt

      if (encryptedName && filenameSalt) {
        try {
          const { masterKeyManager } = await import('@/lib/master-key')
          const masterKey = masterKeyManager.getMasterKey()
          const decrypted = await decryptFilename(
            encryptedName,
            filenameSalt,
            masterKey
          )
          setDecryptedFilename(decrypted)
        } catch (error) {
          console.error('Failed to decrypt filename:', error)
          setDecryptedFilename(null)
        }
      } else {
        setDecryptedFilename(null)
      }
    }

    decryptFilenameAsync()
  }, [itemDetails])

  // Decrypt path when itemDetails changes
  useEffect(() => {
    const decryptPathAsync = async () => {
      // Handle different field names for path
      const encryptedPath = itemDetails?.encrypted_path || itemDetails?.encryptedPath
      const pathSalt = itemDetails?.path_salt || itemDetails?.pathSalt

      if (encryptedPath && pathSalt) {
        try {
          const { masterKeyManager } = await import('@/lib/master-key')
          const masterKey = masterKeyManager.getMasterKey()
          const decrypted = await decryptFilename(
            encryptedPath,
            pathSalt,
            masterKey
          )
          setDecryptedPath(decrypted)
        } catch (error) {
          console.error('Failed to decrypt path:', error)
          setDecryptedPath(null)
        }
      } else {
        setDecryptedPath(null)
      }
    }

    decryptPathAsync()
  }, [itemDetails])

  const loadItemDetailsAndVerify = async () => {
    try {
      setIsLoading(true)
      setSignatureStatus(null)

      // Load item details
      let response
      if (itemType === "file") {
        response = await apiClient.getFileInfo(itemId)
      } else {
        response = await apiClient.getFolderInfo(itemId)
      }

      if (response.success && response.data) {
        // Handle nested data structure for files and folders
        const dataObj = response.data as { file?: FileInfo; folder?: FolderInfo };
        const details = itemType === "file" ? (dataObj.file as ItemDetails | undefined) : (dataObj.folder as ItemDetails | undefined) || (response.data as ItemDetails)
        setItemDetails(details as ItemDetails | null)
        // Note: No success toast shown when details are loaded
      }

      // Auto-verify signature
      let verifyResponse
      if (itemType === "file") {
        verifyResponse = await apiClient.verifyFileSignature(itemId)
      } else {
        verifyResponse = await apiClient.verifyFolderSignature(itemId)
      }

      if (verifyResponse.success) {
        const status = verifyResponse.data?.status || "unknown"
        if (verifyResponse.data?.verified) {
          setSignatureStatus({
            verified: true,
            signerEmail: verifyResponse.data?.signer?.email || "Unknown",
            status: status
          })
        } else {
          setSignatureStatus({
            verified: false,
            error: verifyResponse.data?.message || "Verification failed",
            status: status
          })
        }
      } else {
        setSignatureStatus({
          verified: false,
          error: verifyResponse.error || "Unable to verify signature",
          status: "error"
        })
      }
    } catch (error) {
      console.error("Failed to load details or verify:", error)
      setSignatureStatus({
        verified: false,
        error: "Verification failed",
        status: "error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, hashId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHashId(hashId)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedHashId(null), 2000)
  }

  const downloadAsJSON = () => {
    try {
      // Download the entire /verify endpoint response
      const verifyResponse = {
        itemDetails,
        signatureVerification: signatureStatus,
        timestamp: new Date().toISOString(),
        itemType,
        itemId
      };
      const jsonData = JSON.stringify(verifyResponse, null, 2)
      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${itemName}-verification-details.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Downloaded verification details")
    } catch {
      toast.error("Failed to download verification details")
    }
  }

  const formatDate = (date: string | number | undefined) => {
    if (!date) return "Unknown";
    try {
      // Handle different date formats
      let dateObj: Date;
      if (typeof date === "string") {
        // Try parsing as ISO string first
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          // If that fails, try as timestamp string
          dateObj = new Date(parseInt(date));
        }
      } else {
        // Assume it's a timestamp in seconds
        dateObj = new Date(date * 1000);
      }

      if (isNaN(dateObj.getTime())) {
        return "Invalid date";
      }

      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "Invalid date";
    }
  }

  const truncateMiddle = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    const half = Math.floor(maxLength / 2);
    return text.substring(0, half - 1) + "..." + text.substring(text.length - half + 1);
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
      ) : (
        children
      )}
      <SheetContent side="right" aria-describedby="details-modal-description" className={`${isMobile ? 'w-full sm:max-w-md' : 'sm:max-w-md'} flex flex-col p-0`}>
        <SheetDescription id="details-modal-description" className="sr-only">
          Details for {itemType} {itemName}
        </SheetDescription>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading details...</span>
            </div>
          </div>
        ) : itemDetails ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-6">
                <SheetHeader className="text-left">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {itemType === "file" ? (
                        <IconFile className="h-5 w-5 text-foreground flex-shrink-0" />
                      ) : (
                        <IconFolder className="h-5 w-5 text-foreground flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <SheetTitle className="text-lg font-semibold break-words leading-tight">
                        {itemName}
                      </SheetTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {itemType === "file" ? "File Details" : "Folder Details"}
                      </p>
                    </div>
                  </div>
                </SheetHeader>

                {/* Signature Status Badge */}
                {signatureStatus && (
                  <div className={`flex flex-col gap-2 p-4 rounded-xl border transition-colors ${signatureStatus.verified === true
                    ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                    : signatureStatus.status === "unsigned"
                      ? "border-border bg-muted/50"
                      : "border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
                    }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-full ${signatureStatus.verified === true
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : signatureStatus.status === "unsigned"
                          ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        }`}>
                        {signatureStatus.verified === true ? (
                          <IconShieldCheck className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <IconAlertCircle className="h-4 w-4 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-none ${signatureStatus.verified === true
                          ? "text-emerald-900 dark:text-emerald-100"
                          : signatureStatus.status === "unsigned"
                            ? "text-foreground"
                            : "text-amber-900 dark:text-amber-100"
                          }`}>
                          {signatureStatus.verified === true
                            ? "Verified Signature"
                            : signatureStatus.status === "unsigned"
                              ? "No Signature"
                              : "Invalid Signature"}
                        </p>
                      </div>
                    </div>
                    {signatureStatus.verified === true && signatureStatus.signerEmail && (
                      <p className="text-xs text-muted-foreground ml-9">
                        Verified as uploaded by <span className="font-medium text-foreground">{signatureStatus.signerEmail}</span>
                      </p>
                    )}
                  </div>
                )}

                <Separator />

                {/* Details Section */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {/* Name */}
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Original Name</span>
                      <p className="text-sm font-medium break-all">
                        {decryptedFilename || itemDetails.filename || itemDetails.encryptedFilename || itemName}
                      </p>
                    </div>

                    {/* Path */}
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Location</span>
                      <p className="text-sm font-medium">
                        {itemType === "folder" && (itemDetails.parentId === null || itemDetails.parentId === undefined) ? 'Root' : (decryptedPath || itemDetails.path || 'Root')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Type */}
                      <div className="space-y-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Type</span>
                        <p className="text-sm font-medium capitalize">{itemType}</p>
                      </div>

                      {/* Shared */}
                      <div className="space-y-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Shared</span>
                        <p className="text-sm font-medium">{itemDetails.is_shared ? 'Yes' : 'No'}</p>
                      </div>
                    </div>

                    {itemType === "file" && (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Size */}
                        <div className="space-y-1">
                          <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Size</span>
                          <p className="text-sm font-medium">{itemDetails.size ? formatBytes(itemDetails.size) : '-'}</p>
                        </div>

                        {/* Mimetype */}
                        <div className="space-y-1">
                          <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Format</span>
                          <p className="text-sm font-medium truncate">{itemDetails.mimetype || 'Unknown'}</p>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Timeline */}
                    <div className="space-y-3">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Timeline</span>

                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <IconCalendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="text-sm font-medium">{formatDate(itemDetails.created_at || itemDetails.createdAt)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <IconCalendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Last modified</p>
                          <p className="text-sm font-medium">{formatDate(itemDetails.updatedAt || itemDetails.updated_at || itemDetails.createdAt || itemDetails.created_at)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Security & Hash */}
                    {itemType === "file" && itemDetails.sha_hash && (
                      <div className="space-y-3 pt-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Security Proof (SHA-256)</span>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border group">
                          <code className="text-xs font-mono text-muted-foreground flex-1 break-all">
                            {itemDetails.sha_hash}
                          </code>
                          <Button
                            onClick={() => itemDetails?.sha_hash && copyToClipboard(itemDetails.sha_hash, "hash")}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {copiedHashId === "hash" ? (
                              <IconCheck className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <IconCopy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Retention Policy */}
                    {itemDetails.lockedUntil && new Date(itemDetails.lockedUntil) > new Date() && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                          <IconLock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-tighter">Retention Lock Active</p>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            Immutable until {formatDate(itemDetails.lockedUntil)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="p-6 border-t bg-muted/20">
              <div className="flex gap-3">
                <Button
                  onClick={downloadAsJSON}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  <IconDownload className="h-4 w-4 mr-2" />
                  Audit Proof (JSON)
                </Button>
                <Button
                  onClick={() => setOpen(false)}
                  variant="secondary"
                  className="h-10"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-muted-foreground">No details found for this item.</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}