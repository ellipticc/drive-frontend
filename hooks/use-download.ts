/**
 * Download Hook
 *
 * Provides a React hook for downloading encrypted files with progress tracking
 */

import { useState, useCallback } from 'react';
import { downloadEncryptedFile, downloadFileToBrowser, DownloadProgress, DownloadResult } from '../lib/download';
import { keyManager } from '../lib/key-manager';

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

  const downloadFile = useCallback(async (fileId: string) => {
    try {
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
      });

      setResult(downloadResult);
      setProgress({ stage: 'complete', overallProgress: 100 });
      options.onComplete?.(downloadResult);

      // Auto-trigger browser download if requested
      if (options.autoTriggerDownload) {
        await downloadFileToBrowser(fileId, keys);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
      setProgress(null);
      options.onError?.(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [options]);

  const downloadToBrowser = useCallback(async (fileId: string) => {
    try {
      setIsDownloading(true);
      setError(null);
      setProgress({ stage: 'initializing', overallProgress: 0 });

      // Get user keys
      const keys = await keyManager.getUserKeys();

      // Download and trigger browser download
      await downloadFileToBrowser(fileId, keys, (progressUpdate) => {
        setProgress(progressUpdate);
        options.onProgress?.(progressUpdate);
      });

      setProgress({ stage: 'complete', overallProgress: 100 });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
      setProgress(null);
      options.onError?.(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setIsDownloading(false);
    setError(null);
    setResult(null);
    setProgress(null);
  }, []);

  return {
    downloadFile,
    downloadToBrowser,
    isDownloading,
    error,
    result,
    progress,
    reset
  };
}