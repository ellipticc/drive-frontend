"use client"

import { useEffect, useState } from "react"
import { Loader2, ZoomIn, ZoomOut, Image as ImageIcon, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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

  // Optional for dashboard usage
  shareDetails?: any
  onGetShareCEK?: () => Promise<Uint8Array>

  // Callbacks
  onProgress?: (progress: DownloadProgress) => void
  onError?: (error: string) => void

  // External state control
  isLoading?: boolean
  setIsLoading?: (loading: boolean) => void
}

export function ImagePreview({
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

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)
        setZoom(1)

        let result;

        if (onGetShareCEK) {
          // Shared link context - use CEK
          const shareCekRaw = await onGetShareCEK()
          const shareCek = new Uint8Array(shareCekRaw);

          let fileCek = shareCek;

          // If we have shareDetails, we might need to unwrap the FILE Key from the SHARE Key
          if (shareDetails) {
            // Single File Share: The file CEK is wrapped with the share CEK
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

        url = URL.createObjectURL(result.blob)
        setImageUrl(url)
      } catch (err) {
        if (!isMounted) return
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
      if (url) URL.revokeObjectURL(url)
    }
  }, [fileId, onGetShareCEK, setIsLoading, onProgress, onError, shareDetails])

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
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          disabled={!imageUrl || zoom <= 0.1}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-mono text-muted-foreground w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          disabled={!imageUrl || zoom >= 4}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}