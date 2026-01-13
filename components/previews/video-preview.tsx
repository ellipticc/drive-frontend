"use client"

import { useEffect, useState } from "react"
import { IconLoader2 as Loader2, IconAlertCircle as AlertCircle, IconPlayerPlay as PlayCircle } from "@tabler/icons-react"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"
import type { ShareItem } from "@/lib/api"

interface ShareContext extends Partial<ShareItem> {
  is_folder?: boolean;
  wrapped_cek?: string;
  nonce_wrap?: string;
  // Include ShareItem properties for dashboard compatibility
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  createdAt?: string;
  expiresAt?: string;
  permissions?: string;
  revoked?: boolean;
  linkSecret?: string;
  views?: number;
  maxViews?: number;
  maxDownloads?: number;
  downloads?: number;
  folderPath?: string;
  mimeType?: string;
  encryptedFilename?: string;
  filenameSalt?: string;
  folderPathSalt?: string;
  recipients?: Array<{
    id: string;
    userId?: string;
    email?: string;
    name?: string;
    status: string;
    createdAt: string;
    revokedAt?: string;
  }>;
  has_password?: boolean;
  comments_enabled?: boolean | number;
  comments_locked?: boolean | number;
}

interface VideoPreviewProps {
  fileId: string
  mimeType?: string
  mimetype?: string
  fileSize?: number
  fileName?: string
  filename?: string

  shareDetails?: ShareContext
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
  shareDetails,
  onGetShareCEK,
  onProgress,
  onError,
  isLoading: externalIsLoading,
  setIsLoading: setExternalIsLoading,
  fileName,
  filename
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
    const abortController = new AbortController()

    const loadVideo = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)
        setVideoUrl(null)

        // Dynamically import StreamManager to avoid SSR issues if any
        const { StreamManager } = await import("@/lib/streaming");

        // Ensure Service Worker is active and controlling the page
        if ('serviceWorker' in navigator) {
          // Wait for registration to finish and become active
          await navigator.serviceWorker.ready;

          if (!navigator.serviceWorker.controller) {
            console.debug("[VideoPreview] SW active but not controlling. Waiting for claim...");
            await new Promise<void>((resolve) => {
              const onControllerChange = () => {
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                resolve();
              };
              navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

              // 4s timeout to prevent infinite hang
              setTimeout(() => {
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                resolve();
              }, 4000);
            });
          }

          if (!navigator.serviceWorker.controller) {
            console.warn("[VideoPreview] Service Worker failed to take control. Video playback might fail.");
          }
        }

        // 1. Register file for streaming (gets metadata, keys, and prepares SW mapping)
        await StreamManager.getInstance().registerFile(fileId, shareDetails as unknown as ShareItem | undefined, onGetShareCEK);

        if (!isMounted) return;

        // 2. Construct Stream URL
        // Format: /stream/:fileId/:filename
        // The Service Worker intercepts this path
        const safeName = (filename || fileName || 'video.mp4').replace(/\//g, '_');
        url = `/stream/${fileId}/${safeName}`;

        setVideoUrl(url)

      } catch (err) {
        if (!isMounted || (err instanceof Error && err.name === 'AbortError')) return
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
      abortController.abort()
      // No need to revoke Blob URL since we use a virtual stream path
    }
  }, [fileId, onGetShareCEK, setIsLoading, onProgress, onError, shareDetails, mimetype, mimeType, fileName, filename])

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