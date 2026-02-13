"use client"

import { useEffect, useState } from "react"
import { IconLoader2 as Loader2, IconFileText as FileText, IconAlertCircle as AlertCircle } from "@tabler/icons-react"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"

interface TextPreviewProps {
  fileId: string
  mimeType?: string
  mimetype?: string
  fileSize?: number
  fileName?: string
  filename?: string


  onProgress?: (progress: DownloadProgress) => void
  onError?: (error: string) => void

  isLoading?: boolean
  setIsLoading?: (loading: boolean) => void
}

export function TextPreview({
  fileId,
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
    const abortController = new AbortController()

    const loadText = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)

        // Dashboard context - use user keys
        const result = await downloadEncryptedFile(fileId, undefined, onProgress, abortController.signal)

        if (!isMounted) return

        const text = await result.blob.text()
        setTextContent(text)
      } catch (err) {
        if (!isMounted || (err instanceof Error && err.name === 'AbortError')) return
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
      abortController.abort()
    }
  }, [fileId, setIsLoading, onProgress, onError])

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