/**
 * Preview Download Manager
 *
 * Manages file downloads with progress tracking and automatic preview modal opening
 */

import React, { useState, useCallback } from 'react';
import { UnifiedProgressModal } from '../modals/unified-progress-modal';
import { usePreviewDownload } from '../../hooks/use-preview-download';
import { PreviewModal } from '../previews/preview-modal';

interface PreviewDownloadManagerProps {
  children: (downloadFile: (fileId: string, filename: string, fileSize: number, mimeType: string) => void) => React.ReactNode;
}

export function PreviewDownloadManager({ children }: PreviewDownloadManagerProps) {
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    name: string;
    type: 'file';
    mimeType: string;
    size: number;
    blobUrl?: string;
  } | null>(null);

  const {
    downloadForPreview,
    retryDownload,
    cancelDownload,
    error,
    progress,
    currentFileId,
    currentFilename,
    currentFileSize,
    reset: resetDownload
  } = usePreviewDownload({
    onComplete: (result, fileId, filename, fileSize) => {
      // Create blob URL from the downloaded blob
      const blobUrl = URL.createObjectURL(result.blob);

      // Set up preview data
      setPreviewFile({
        id: fileId,
        name: filename,
        type: 'file',
        mimeType: result.mimetype,
        size: fileSize,
        blobUrl
      });
      // Open preview modal
      setPreviewModalOpen(true);
    }
  });

  const handleDownloadFile = useCallback((fileId: string, filename: string, fileSize: number, mimeType: string) => {
    setPreviewFile({
      id: fileId,
      name: filename,
      type: 'file',
      mimeType,
      size: fileSize
    });
    downloadForPreview(fileId, filename, fileSize);
    setProgressModalOpen(true);
  }, [downloadForPreview]);

  const handleDownloadComplete = useCallback(() => {
    // This is called when the progress modal detects completion
    // The actual preview opening is handled in the onComplete callback above
  }, []);

  const handleProgressModalClose = useCallback(() => {
    // Clean up completed downloads when modal closes
    if (progress?.stage === 'complete') {
      resetDownload();
      setPreviewFile(null);
    }
    setProgressModalOpen(false);
  }, [progress?.stage, resetDownload]);

  const handlePreviewModalClose = useCallback((open: boolean) => {
    setPreviewModalOpen(open);
    // Clean up blob URL when preview closes
    if (!open && previewFile?.blobUrl) {
      URL.revokeObjectURL(previewFile.blobUrl);
    }
  }, [previewFile]);

  return (
    <>
      {children(handleDownloadFile)}

      <UnifiedProgressModal
        open={progressModalOpen}
        onOpenChange={setProgressModalOpen}
        onClose={handleProgressModalClose}
        downloadProgress={progress}
        downloadFilename={currentFilename}
        downloadFileSize={currentFileSize}
        downloadFileId={currentFileId || undefined}
        onCancelDownload={cancelDownload}
        onRetryDownload={retryDownload}
        downloadError={error}
        onDownloadComplete={handleDownloadComplete}
      />

      {previewFile && (
        <PreviewModal
          open={previewModalOpen}
          onOpenChange={handlePreviewModalClose}
          file={previewFile}
        />
      )}
    </>
  );
}