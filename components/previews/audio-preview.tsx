"use client"

import { useEffect, useRef, useState } from "react"
import { IconPlayerPlay as Play, IconPlayerPause as Pause, IconVolume as Volume2, IconVolumeOff as VolumeX, IconLoader2 as Loader2, IconMusic as Music } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { downloadEncryptedFileWithCEK, downloadEncryptedFile, DownloadProgress } from "@/lib/download"
import { decryptData } from "@/lib/crypto"

interface AudioPreviewProps {
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

export function AudioPreview({
  fileId,
  mimeType,
  mimetype,
  fileSize,
  fileName,
  filename,
  shareDetails,
  onGetShareCEK,
  onProgress,
  onError,
  isLoading: externalIsLoading,
  setIsLoading: setExternalIsLoading
}: AudioPreviewProps) {
  // Normalize props
  const effectiveMimeType = mimeType || mimetype || 'audio/mpeg'
  const effectiveFileName = fileName || filename || 'Audio File'

  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [internalIsLoading, setInternalIsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [internalError, setInternalError] = useState<string | null>(null)

  const isLoading = externalIsLoading ?? internalIsLoading
  const setIsLoading = setExternalIsLoading ?? setInternalIsLoading
  const error = internalError

  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLInputElement>(null)

  // Initialize audio
  useEffect(() => {
    let isMounted = true
    let url: string | null = null
    const abortController = new AbortController()

    const loadAudio = async () => {
      try {
        setIsLoading(true)
        setInternalError(null)

        let result;

        if (onGetShareCEK) {
          // Shared link context - use CEK
          const shareCekRaw = await onGetShareCEK()
          const shareCek = new Uint8Array(shareCekRaw); // Clone for safety

          let fileCek = shareCek;

          // If we have shareDetails, we might need to unwrap the FILE Key from the SHARE Key
          if (shareDetails) {
            // Single File Share: The file CEK is wrapped with the share CEK
            if (!shareDetails.is_folder && shareDetails.wrapped_cek && shareDetails.nonce_wrap) {
              try {
                fileCek = new Uint8Array(decryptData(shareDetails.wrapped_cek, shareCek, shareDetails.nonce_wrap));
              } catch (e) {
                console.error('Failed to unwrap file key:', e);
                // Fallback to shareCek? Unlikely to work if wrapped.
              }
            }
            // Folder Share: logic handles inside page.tsx usually, but if previewing strict fileId...
            // If shareDetails maps to the file directly (single file share), standard logic applies.
          }

          result = await downloadEncryptedFileWithCEK(fileId, fileCek, onProgress, abortController.signal)
        } else {
          // Dashboard context - use user keys (handled by downloadEncryptedFile)
          result = await downloadEncryptedFile(fileId, undefined, onProgress, abortController.signal)
        }

        if (!isMounted) return

        url = URL.createObjectURL(result.blob)
        setAudioUrl(url)
      } catch (err) {
        if (!isMounted || (err instanceof Error && err.name === 'AbortError')) return
        const errorMessage = err instanceof Error ? err.message : "Failed to load audio preview"
        console.error("Failed to load audio preview:", err)
        setInternalError(errorMessage)
        onError?.(errorMessage)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadAudio()

    return () => {
      isMounted = false
      abortController.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [fileId, onGetShareCEK, setIsLoading, onProgress, onError])

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    setDuration(audioRef.current.duration)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    const newMuted = !isMuted
    setIsMuted(newMuted)
    audioRef.current.muted = newMuted
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.volume = val
      setVolume(val)
      setIsMuted(val === 0)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-destructive/10 p-3 rounded-full mb-3">
          <Music className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm text-destructive font-medium">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-[85vw] md:w-full max-w-md mx-auto space-y-4 md:space-y-6 py-2 md:py-6">
      {/* Visualizer / Icon placeholder */}
      <div className="flex items-center justify-center">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center bg-muted">
          {isLoading ? (
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          ) : (
            <Music className="h-12 w-12 text-primary" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-center font-medium truncate px-4">
          {effectiveFileName}
        </h3>

        {/* Controls */}
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-1">
            <input
              ref={progressBarRef}
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={isLoading || !audioUrl}
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-1/4">
              {/* Volume mini control */}
              <button
                onClick={toggleMute}
                disabled={isLoading}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                disabled={isLoading}
                className="w-20 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-muted-foreground/50 hidden sm:block"
              />
            </div>

            <div className="flex items-center justify-center w-2/4">
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg"
                onClick={togglePlay}
                disabled={isLoading || !audioUrl}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                )}
              </Button>
            </div>

            <div className="w-1/4" /> {/* Spacer for symmetry */}
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl || ""}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  )
}