"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog"
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
} from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { truncateFilename } from "@/lib/utils"
import { decryptFilename } from "@/lib/crypto"

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
      const encryptedName = itemDetails?.encrypted_filename || itemDetails?.encryptedName
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
        const details = itemType === "file" ? response.data.file : response.data.folder || response.data
        setItemDetails(details)
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
    } catch (error) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && externalOnOpenChange === undefined ? (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      ) : (
        children
      )}
      <DialogContent className="sm:max-w-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
            <span className="text-sm text-slate-500">Loading...</span>
          </div>
        ) : itemDetails ? (
          <div className="space-y-4">
            <DialogHeader className="pb-2">
              <div className="flex items-start gap-3">
                {itemType === "file" ? (
                  <IconFile className="h-5 w-5 text-slate-600 dark:text-slate-400 mt-1 flex-shrink-0" />
                ) : (
                  <IconFolder className="h-5 w-5 text-slate-600 dark:text-slate-400 mt-1 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold break-words">
                    {truncateFilename(itemName, 50)}
                  </h2>
                </div>
              </div>
            </DialogHeader>

            {/* Signature Status Badge */}
            {signatureStatus && (
              <div className={`flex flex-col gap-2 px-3 py-3 rounded-lg border ${
                signatureStatus.verified === true
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
                  : signatureStatus.status === "unsigned"
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30"
                  : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
              }`}>
                <div className="flex items-center gap-2">
                  {signatureStatus.verified === true ? (
                    <IconShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  ) : signatureStatus.status === "unsigned" ? (
                    <IconAlertCircle className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  ) : (
                    <IconAlertCircle className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${
                      signatureStatus.verified === true
                        ? "text-emerald-900 dark:text-emerald-100"
                        : signatureStatus.status === "unsigned"
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-amber-900 dark:text-amber-100"
                    }`}>
                      {signatureStatus.verified === true
                        ? "Digital signature has been verified"
                        : signatureStatus.status === "unsigned"
                        ? "No Signature"
                        : "Invalid Signature"}
                    </p>
                  </div>
                </div>
                {signatureStatus.verified === true && signatureStatus.signerEmail && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 ml-6">
                    {itemType === "file" ? "File" : "Folder"} has been uploaded/imported by {signatureStatus.signerEmail}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Details</h3>

              <div className="grid grid-cols-1 gap-2">
                {/* Original Filename */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Name</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                    {truncateMiddle(decryptedFilename || itemDetails.filename || itemDetails.encryptedFilename || itemName, 30)}
                  </span>
                </div>

                {/* Path */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Path</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                    {itemType === "folder" && (itemDetails.parentId === null || itemDetails.parentId === undefined) ? 'Root' : (decryptedPath || itemDetails.path || 'Root')}
                  </span>
                </div>

                {/* Created By */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Created By</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                    {signatureStatus?.signerEmail || '-'}
                  </span>
                </div>

                {/* Upload Date */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <IconCalendar className="h-3 w-3 text-slate-600 dark:text-slate-400" /> Upload Date
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {formatDate(itemDetails.created_at || itemDetails.createdAt) || '-'}
                  </span>
                </div>

                {/* Last Modified Date */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <IconCalendar className="h-3 w-3 text-slate-600 dark:text-slate-400" /> Last Modified
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {formatDate(itemDetails.updatedAt || itemDetails.updated_at || itemDetails.createdAt || itemDetails.created_at) || '-'}
                  </span>
                </div>

                {/* Type */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Type</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {itemType}
                  </span>
                </div>

                {/* Mimetype - Only for files */}
                {itemType === "file" && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Mimetype</span>
                    <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {itemDetails.mimetype || '-'}
                    </span>
                  </div>
                )}

                {/* Size - Only for files */}
                {itemType === "file" && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Size</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {itemDetails.size ? formatBytes(itemDetails.size) : '-'}
                    </span>
                  </div>
                )}

                {/* Is Shared */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Shared</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {itemDetails.is_shared ? 'Yes' : 'No'}
                  </span>
                </div>

                {/* Hash - Only for files */}
                {itemType === "file" && itemDetails.sha_hash && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Hash</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono text-slate-700 dark:text-slate-300">
                        {itemDetails.sha_hash.substring(0, 16)}...
                      </code>
                      <Button
                        onClick={() => copyToClipboard(itemDetails.sha_hash, "hash")}
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                      >
                        {copiedHashId === "hash" ? (
                          <IconCheck className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <IconCopy className="h-3 w-3 text-slate-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                onClick={downloadAsJSON}
                variant="outline"
                size="sm"
                className="text-xs h-8"
              >
                <IconDownload className="h-3 w-3 mr-1" />
                Download JSON
              </Button>
              <Button
                onClick={() => setOpen(false)}
                variant="ghost"
                size="sm"
                className="text-xs h-8"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-slate-500">No details available</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}