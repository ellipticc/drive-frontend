"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle, PlayCircle } from "lucide-react"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"

interface VideoPreviewProps {
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

export function VideoPreview({
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
}: VideoPreviewProps) {
  const [internalIsLoading, setInternalIsLoading] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const isLoading = externalIsLoading ?? internalIsLoading
  const setIsLoading = setExternalIsLoading ?? setInternalIsLoading
  const error = internalError

  useEffect(() => {
    let isMounted = true
    let url: string | null = null

    const loadVideo = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)
        setVideoUrl(null)

        let result;

        // 1. Download & Decrypt
        if (onGetShareCEK) {
          const shareCekRaw = await onGetShareCEK()
          const shareCek = new Uint8Array(shareCekRaw);

          let fileCek = shareCek;

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
          result = await downloadEncryptedFile(fileId, undefined, onProgress)
        }

        if (!isMounted) return

        // 2. Create Blob URL
        const blob = new Blob([result.blob], { type: mimetype || mimeType || 'video/mp4' });
        url = URL.createObjectURL(blob);
        setVideoUrl(url)

      } catch (err) {
        if (!isMounted) return
        const errorMessage = err instanceof Error ? err.message : "Failed to load video preview"
        console.error("Failed to load video preview:", err)
        setInternalError(errorMessage)
        onError?.(errorMessage)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadVideo()

    return () => {
      isMounted = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [fileId, onGetShareCEK, setIsLoading, onProgress, onError, shareDetails, mimetype, mimeType])

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
        <p className="text-muted-foreground text-sm">Loading video...</p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col items-center justify-center relative">
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          controlsList="nodownload"
          className="w-full max-h-[70vh] aspect-video object-contain"
          playsInline
        >
          <p>Your browser does not support the video tag.</p>
        </video>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground w-full">
          <PlayCircle className="h-16 w-16 mb-2 opacity-20" />
        </div>
      )}
    </div>
  )
}