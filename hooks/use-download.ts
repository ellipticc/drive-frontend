/**
 * Download Hook
 *
 * Provides a React hook for downloading encrypted files with progress tracking
 */

import { useRef, useState, useCallback } from 'react';
import { downloadEncryptedFile, downloadFileToBrowser, DownloadProgress, DownloadResult, PauseController } from '@/lib/download';
import { keyManager } from '@/lib/key-manager';

export interface UseDownloadOptions {
  autoTriggerDownload?: boolean; // Automatically trigger browser download when complete
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: string) => void;
  onComplete?: (result: DownloadResult) => void;
}

export function useDownload(options: UseDownloadOptions = {}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pauseResolverRef = useRef<(() => void) | null>(null);
  const pauseControllerRef = useRef<PauseController>({
    isPaused: false,
    waitIfPaused: async () => {
      if (pauseControllerRef.current.isPaused) {
        await new Promise<void>(resolve => {
          pauseResolverRef.current = resolve;
        });
      }
    }
  });

  const downloadFile = useCallback(async (fileId: string) => {
    try {
      reset(); // Reset all states including abort controller and pause state

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Reset pause state
      setIsPaused(false);
      pauseControllerRef.current.isPaused = false;
      if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
      }

      setIsDownloading(true);
      setError(null);
      setResult(null);
      setProgress({ stage: 'initializing', overallProgress: 0 });

      // Get user keys
      const keys = await keyManager.getUserKeys();

      // Download the file
      const downloadResult = await downloadEncryptedFile(fileId, keys, (progressUpdate) => {
        setProgress(progressUpdate);
        options.onProgress?.(progressUpdate);
      }, controller.signal, pauseControllerRef.current);

      setResult(downloadResult);
      setProgress({ stage: 'complete', overallProgress: 100 });
      options.onComplete?.(downloadResult);

      // Auto-trigger browser download if requested
      if (options.autoTriggerDownload) {
        await downloadFileToBrowser(fileId, keys, (progressUpdate) => {
          setProgress(progressUpdate);
          options.onProgress?.(progressUpdate);
        }, controller.signal, pauseControllerRef.current);
      }

    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log("Download aborted.");
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
      setProgress(null);
      options.onError?.(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [options]);

  const downloadToBrowser = useCallback(async (fileId: string) => {
    let controller: AbortController | null = null;
    try {
      reset(); // Reset all states including abort controller and pause state

      controller = new AbortController();
      abortControllerRef.current = controller;

      // Reset pause state
      setIsPaused(false);
      pauseControllerRef.current.isPaused = false;
      if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
      }

      setIsDownloading(true);
      setError(null);
      setProgress({ stage: 'initializing', overallProgress: 0 });

      // Get user keys
      const keys = await keyManager.getUserKeys();

      // Download and trigger browser download
      downloadFileToBrowser(fileId, keys, (p) => {
        setProgress(p);
        options.onProgress?.(p);
      }, controller.signal, pauseControllerRef.current)
        .then((result) => {
          if (controller?.signal.aborted) return;
          setIsDownloading(false);
          setProgress({ stage: 'complete', overallProgress: 100 });
          options.onComplete?.(result);
        })
        .catch((err) => {
          if (controller?.signal.aborted) return; // Ignore aborts
          console.error("Download failed", err);
          const errorMessage = err instanceof Error ? err.message : 'Download failed';
          setError(errorMessage);
          setIsDownloading(false);
          setProgress(null);
          options.onError?.(errorMessage);
        });
    } catch (err) {
      if (controller?.signal.aborted) return;
      console.error("Download initialization failed", err);
      const errorMessage = err instanceof Error ? err.message : 'Download failed to initialize';
      setError(errorMessage);
      setIsDownloading(false);
      options.onError?.(errorMessage);
    }
  }, [options]);

  const pause = useCallback(() => {
    setIsPaused(true);
    pauseControllerRef.current.isPaused = true;
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    pauseControllerRef.current.isPaused = false;
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null; // Clear the ref after aborting
    setIsDownloading(false);
    setError(null);
    setResult(null);
    setProgress(null);
    setIsPaused(false);
    pauseControllerRef.current.isPaused = false;
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, []);

  return {
    downloadFile,
    downloadToBrowser,
    isDownloading,
    error,
    result,
    progress,
    reset,
    pause,
    resume,
    isPaused
  };
}