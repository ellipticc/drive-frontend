"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
        setItemDetails(response.data)
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
      const jsonData = JSON.stringify(itemDetails, null, 2)
      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${itemName}-details.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Downloaded")
    } catch (error) {
      toast.error("Failed to download")
    }
  }

  const formatDate = (date: string | number) => {
    try {
      const d = new Date(typeof date === "string" ? date : date * 1000)
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch {
      return "Invalid date"
    }
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
                  <IconFile className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                ) : (
                  <IconFolder className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base break-words">
                    {truncateFilename(itemName, 50)}
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>

            {/* Signature Status Badge */}
            {signatureStatus && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                signatureStatus.verified === true
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
                  : signatureStatus.status === "unsigned"
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30"
                  : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
              }`}>
                {signatureStatus.verified === true ? (
                  <IconShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                ) : signatureStatus.status === "unsigned" ? (
                  <IconAlertCircle className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                ) : (
                  <IconAlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${
                    signatureStatus.verified === true
                      ? "text-emerald-900 dark:text-emerald-100"
                      : signatureStatus.status === "unsigned"
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-amber-900 dark:text-amber-100"
                  }`}>
                    {signatureStatus.verified === true
                      ? "Verified"
                      : signatureStatus.status === "unsigned"
                      ? "No Signature"
                      : "Invalid"}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Basic Info */}
            <div className="space-y-2">
              {itemDetails.size && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Size</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {formatBytes(itemDetails.size)}
                  </span>
                </div>
              )}

              {itemDetails.mimetype && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Type</span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{itemDetails.mimetype}</span>
                </div>
              )}

              {itemDetails.created_at && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <IconCalendar className="h-3 w-3" /> Created
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{formatDate(itemDetails.created_at)}</span>
                </div>
              )}

              {itemDetails.sha256_hash && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">SHA256</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {itemDetails.sha256_hash.substring(0, 16)}...
                    </code>
                    <Button
                      onClick={() => copyToClipboard(itemDetails.sha256_hash, "sha256")}
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                    >
                      {copiedHashId === "sha256" ? (
                        <IconCheck className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <IconCopy className="h-3 w-3 text-slate-500" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
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
                Export
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