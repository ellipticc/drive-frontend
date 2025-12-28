/**
 * Preview Download Hook
 *
 * Provides a React hook for downloading encrypted files with progress tracking
 * and automatic preview modal opening on completion
 */

import { useState, useCallback, useRef } from 'react';
import { downloadEncryptedFile, DownloadProgress, DownloadResult } from '../lib/download';
import { keyManager } from '../lib/key-manager';

export interface UsePreviewDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  onError?: (error: string) => void;
  onComplete?: (result: DownloadResult, fileId: string, filename: string, fileSize: number) => void;
  autoOpenPreview?: boolean;
}

export function usePreviewDownload(options: UsePreviewDownloadOptions = {}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [currentFileSize, setCurrentFileSize] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const downloadForPreview = useCallback(async (fileId: string, filename: string, fileSize: number) => {
    try {
      // Abort existing download first
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsDownloading(true);
      setError(null);
      setResult(null);
      setProgress({ stage: 'initializing', overallProgress: 0 });
      setCurrentFileId(fileId);
      setCurrentFilename(filename);
      setCurrentFileSize(fileSize);

      // Get user keys
      const keys = await keyManager.getUserKeys();

      // Download the file
      const downloadResult = await downloadEncryptedFile(fileId, keys, (progressUpdate) => {
        setProgress(progressUpdate);
        options.onProgress?.(progressUpdate);
      }, controller.signal);

      setResult(downloadResult);
      setProgress({ stage: 'complete', overallProgress: 100 });
      options.onComplete?.(downloadResult, fileId, filename, fileSize);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
      setProgress(null);
      options.onError?.(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [options]);

  const retryDownload = useCallback(async () => {
    if (currentFileId && currentFilename) {
      await downloadForPreview(currentFileId, currentFilename, currentFileSize);
    }
  }, [currentFileId, currentFilename, currentFileSize, downloadForPreview]);

  const cancelDownload = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsDownloading(false);
    setError(null);
    setResult(null);
    setProgress(null);
    setCurrentFileId(null);
    setCurrentFilename('');
    setCurrentFileSize(0);
  }, []);

  const reset = useCallback(() => {
    setIsDownloading(false);
    setError(null);
    setResult(null);
    setProgress(null);
    setCurrentFileId(null);
    setCurrentFilename('');
    setCurrentFileSize(0);
  }, []);

  return {
    downloadForPreview,
    retryDownload,
    cancelDownload,
    isDownloading,
    error,
    result,
    progress,
    currentFileId,
    currentFilename,
    currentFileSize,
    reset
  };
}