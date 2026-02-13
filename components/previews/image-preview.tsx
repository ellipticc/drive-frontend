"use client"

import { useEffect, useState } from "react"
import { IconLoader2 as Loader2, IconZoomIn as ZoomIn, IconZoomOut as ZoomOut, IconPhoto as ImageIcon, IconAlertCircle as AlertCircle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"

interface ImagePreviewProps {
  fileId: string
  // Support both naming conventions
  mimeType?: string
  mimetype?: string
  fileSize?: number
  fileName?: string
  filename?: string

  // Callbacks
  onProgress?: (progress: DownloadProgress) => void
  onError?: (error: string) => void

  // External state control
  isLoading?: boolean
  setIsLoading?: (loading: boolean) => void
}

export function ImagePreview({
  fileId,
  fileName,
  filename,
  onProgress,
  onError,
  isLoading: externalIsLoading,
  setIsLoading: setExternalIsLoading
}: ImagePreviewProps) {
  const [internalIsLoading, setInternalIsLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const isLoading = externalIsLoading ?? internalIsLoading
  const setIsLoading = setExternalIsLoading ?? setInternalIsLoading
  const error = internalError

  const effectiveFileName = fileName || filename || 'Image'

  useEffect(() => {
    let isMounted = true
    let url: string | null = null
    const abortController = new AbortController()

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)
        setZoom(1)

        // Dashboard context - use user keys
        const result = await downloadEncryptedFile(fileId, undefined, onProgress, abortController.signal)
      
        if (!isMounted) return

        url = URL.createObjectURL(result.blob)
        setImageUrl(url)
      } catch (err) {
        if (!isMounted || (err instanceof Error && err.name === 'AbortError')) return
        const errorMessage = err instanceof Error ? err.message : "Failed to load image preview"
        console.error("Failed to load image preview:", err)
        setInternalError(errorMessage)
        onError?.(errorMessage)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadImage()

    return () => {
      isMounted = false
      abortController.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [fileId, setIsLoading, onProgress, onError])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.1))

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
        <p className="text-muted-foreground text-sm">Loading image...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div className="relative overflow-auto max-h-[70vh] w-full flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={effectiveFileName}
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
            className="max-w-full h-auto object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-2 opacity-20" />
            <p className="text-sm">No image data</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              disabled={!imageUrl || zoom <= 0.1}
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        <span className="text-sm font-mono text-muted-foreground w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              disabled={!imageUrl || zoom >= 4}
              aria-label="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}