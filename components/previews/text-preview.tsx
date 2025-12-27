"use client"

import { useEffect, useState } from "react"
import { Loader2, FileText, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"

interface TextPreviewProps {
  fileId: string
  mimeType?: string
  mimetype?: string
  fileSize?: number
  fileName?: string
  filename?: string

  shareDetails?: any
  onGetShareCEK?: () => Promise<Uint8Array>

  onProgress?: (progress: DownloadProgress) => void
  onError?: (error: string) => void

  isLoading?: boolean
  setIsLoading?: (loading: boolean) => void
}

export function TextPreview({
  fileId,
  mimeType,
  mimetype,
  fileName,
  filename,
  shareDetails,
  onGetShareCEK,
  onProgress,
  onError,
  isLoading: externalIsLoading,
  setIsLoading: setExternalIsLoading
}: TextPreviewProps) {
  const [internalIsLoading, setInternalIsLoading] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [internalError, setInternalError] = useState<string | null>(null)

  const isLoading = externalIsLoading ?? internalIsLoading
  const setIsLoading = setExternalIsLoading ?? setInternalIsLoading
  const error = internalError

  useEffect(() => {
    let isMounted = true

    const loadText = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)

        let result;

        if (onGetShareCEK) {
          // Shared link context - use CEK
          const shareCekRaw = await onGetShareCEK()
          const shareCek = new Uint8Array(shareCekRaw);

          let fileCek = shareCek;

          // Unwrap key logic
          if (shareDetails) {
            if (!shareDetails.is_folder && shareDetails.wrapped_cek && shareDetails.nonce_wrap) {
              try {
                fileCek = new Uint8Array(decryptData(shareDetails.wrapped_cek, shareCek, shareDetails.nonce_wrap));
              } catch (e) {
                console.error('Failed to unwrap file key:', e);
              }
            }
          }

          result = await downloadEncryptedFileWithCEK(fileId, fileCek, onProgress)
        } else {
          // Dashboard context - use user keys
          result = await downloadEncryptedFile(fileId, undefined, onProgress)
        }

        if (!isMounted) return

        const text = await result.blob.text()
        setTextContent(text)
      } catch (err) {
        if (!isMounted) return
        const errorMessage = err instanceof Error ? err.message : "Failed to load text preview"
        console.error("Failed to load text preview:", err)
        setInternalError(errorMessage)
        onError?.(errorMessage)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadText()

    return () => {
      isMounted = false
    }
  }, [fileId, onGetShareCEK, setIsLoading, onProgress, onError, shareDetails])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="font-medium">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground text-sm">Loading text...</p>
      </div>
    )
  }

  return (
    <div className="w-full md:w-[210mm] h-[75vh] bg-muted/50 rounded-lg border p-12 overflow-y-auto flex flex-col items-start justify-start shadow-sm mx-auto my-4 transition-all">
      {textContent ? (
        <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed break-words w-full text-left">
          {textContent}
        </pre>
      ) : (
        <div className="flex flex-col items-center justify-center w-full min-h-[50vh] text-muted-foreground">
          <FileText className="h-12 w-12 mb-2 opacity-20" />
          <p className="text-sm">No text content</p>
        </div>
      )}
    </div>
  )
}